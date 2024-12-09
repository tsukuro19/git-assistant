// Take in a github link and give us back list file in the url
import {GithubRepoLoader} from '@langchain/community/document_loaders/web/github'
import { Document } from '@langchain/core/documents'
import { generateEmbedding, summariseCode } from './gemini'
import { db } from '@/server/db'
import { Octokit } from 'octokit'

//Error 403: Because github only allow 1000 requests per hour at same IP address
export const loadGithubRepo=async (githubUrl:string, githubToken?:string)=>{
    const loader=new GithubRepoLoader(githubUrl,{
        accessToken:githubToken || '',
        branch: 'main',
        recursive: true,
        ignorePaths:['.gitignore', '*.json','.svg','node_module'],
        unknown: 'warn',
        maxConcurrency:5,//số yêu cầu đồng thờ
    })
    const docs=await loader.load()

    return docs;
}

export const indexGithubRepo=async (projectId:string,githubUrl:string,githubToken?:string)=>{
    const docs=await loadGithubRepo(githubUrl,githubToken);
    const allEmbeddings=await generateEmbeddings(docs)
    await Promise.allSettled(allEmbeddings.map(async (embedding,index)=>{
        console.log(`processing ${index+1} of ${allEmbeddings.length}`)
        if(!embedding) return
        
        const sourceCodeEmbedding=await db.sourceCodeEmbedding.create({
            data:{
                summary:embedding.summary,
                sourceCode:embedding.sourceCode,
                fileName:embedding.fileName,
                projectId,
            }
        })
        console.log(sourceCodeEmbedding)

        await db.$executeRaw`
        UPDATE "SourceCodeEmbedding"
        SET "summaryEmbedding"=${embedding.embedding}::vector
        WHERE id=${sourceCodeEmbedding.id}
        `
    }))
}

function delay(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const generateEmbeddings = async (docs: Document[]) => {
    const results = [];
    for (const doc of docs) {
        console.log(`Processing file: ${doc.metadata.source}`);
        
        const summary = await summariseCode(doc); // Gửi yêu cầu tóm tắt
        const embedding = await generateEmbedding(summary); // Gửi yêu cầu tạo embedding
        
        results.push({
            summary,
            embedding,
            sourceCode: JSON.parse(JSON.stringify(doc.pageContent)),
            fileName: doc.metadata.source,
        });
        
        console.log(`Finished file: ${doc.metadata.source}`);
        await delay(5000); // Chờ 2 giây trước khi xử lý tài liệu tiếp theo
    }
    return results;
};

const getFileCount=async (path:string,octokit:Octokit,githubOwner:string,githubRepo:string,acc:number=0)=>{
    const {data}=await octokit.rest.repos.getContent({
        owner:githubOwner,
        repo:githubRepo,
        path,
    })

    if(!Array.isArray(data) && data.type==='file'){
        return acc+1;
    }

    if(Array.isArray(data)){
        let fileCount=0;
        const directories:string[]=[];

        for (const item of data){
            if(item.type==='dir'){
                directories.push(item.path);
            }else{
                fileCount++;
            }
        }

        if(directories.length>0){
            const directoryCounts=await Promise.all(
                directories.map(dirPath=>getFileCount(dirPath,octokit,githubOwner,githubRepo,acc))
            )
            fileCount+=directoryCounts.reduce((acc,count)=>acc+count,0)
        }
        return acc+fileCount;
    }
    return acc;
}

export const checkCredits=async (githubUrl:string,githubToken?:string)=>{
    //find out how many files in the github repo
    const octokit=new Octokit({
        auth:githubToken,
    });
    const githubOwner=githubUrl.split('/')[3];
    const githubRepo=githubUrl.split('/')[4];
    if(!githubOwner || !githubRepo){
        return 0;
    }
    const fileCount=await getFileCount('',octokit,githubOwner,githubRepo,0);
    return fileCount;
}

