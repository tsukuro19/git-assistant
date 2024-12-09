import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { pollCommits } from "@/lib/github";
import { checkCredits, indexGithubRepo } from "@/lib/github-loader";

/*tRPC (TypeScript Remote Procedure Call) là một framework cho phép bạn xây dựng các API type-safe một cách hiệu quả. 
Với tRPC, bạn có thể gọi các hàm phía server từ phía client mà không cần phải định nghĩa riêng biệt REST endpoints hay GraphQL schemas.*/ 
export const projectRouter=createTRPCRouter({
    createProject:protectedProcedure.input(
        z.object({
            name:z.string(),
            githubUrl:z.string(),
            githubToken:z.string().optional(),
        })
    ).mutation(async({ctx,input})=>{
        const user=await ctx.db.user.findUnique({where:{id:ctx.user.userId!},select:{credits:true}});
        if(!user){
            throw new Error("User not found");
        }
        const currentCredits=user.credits || 0;
        const fileCount=await checkCredits(input.githubUrl,input.githubToken);
        if(currentCredits<fileCount){
            throw new Error("Not enough credits");
        }
        console.log(ctx.user.userId);
        const project=await ctx.db.project.create({
            data:{
                githubUrl:input.githubUrl,
                name:input.name,
                userToProjects:{
                    create:{
                        userId:ctx.user.userId!,//The ! symbol is the non-null
                    }
                }
            }
        })
        if(project){
            await pollCommits(project.id);  
            await indexGithubRepo(project.id,input.githubUrl,input.githubToken);
            await ctx.db.user.update({where:{id:ctx.user.userId!},data:{credits:{decrement:fileCount}}});
        }
        return project;
    }),
    getProjects:protectedProcedure.query(async({ctx})=>{
        const projects=await ctx.db.project.findMany({
            where:{
                userToProjects:{
                    some:{
                        userId:ctx.user.userId!
                    }
                },
                deletedAt:null
            }
        })
        return projects;
    }),
    getCommits:protectedProcedure.input(z.object({
        projectId:z.string()
    })).query(async({ctx,input})=>{
        const commits=await ctx.db.commit.findMany({
            where:{
                projectId:input.projectId
            }
        })
        pollCommits(input.projectId).then().catch(console.error);
        return commits;
    }),
    saveAnswer:protectedProcedure.input(z.object({
        projectId:z.string(),
        question:z.string(),
        answer:z.string(),
        fileReferences:z.any()
    })).mutation(async({ctx,input})=>{
        return await ctx.db.question.create({
            data:{
                answer:input.answer,
                filesReferences:input.fileReferences,
                projectId:input.projectId,
                question:input.question,
                userId:ctx.user.userId!,
            }
        })
    }),
    getQuestions:protectedProcedure.input(z.object({projectId:z.string()})).query(async({ctx,input})=>{
        return await ctx.db.question.findMany({
            where:{
                projectId:input.projectId
            },
            include:{
                user:true,
                project:true
            },
            orderBy:{
                createdAt:'desc'
            }
        })
    }),
    uploadMeeting:protectedProcedure.input(z.object({projectId: z.string(),meetingUrl:z.string(),name:z.string()}))
    .mutation(async ({ctx,input})=>{
        const meeting=await ctx.db.meeting.create({
            data:{
                meetingUrl:input.meetingUrl,
                name:input.name,
                projectId:input.projectId,
                status:"PROCESSING"
            }
        })
        return meeting;
    }),
    getMeetings:protectedProcedure.input(z.object({projectId:z.string()})).query(async({ctx,input})=>{
        return await ctx.db.meeting.findMany({where:{projectId:input.projectId},include:{issues:true}});
    }),
    deleteMeeting:protectedProcedure.input(z.object({meetingId:z.string()})).mutation(async({ctx,input})=>{
        await ctx.db.issue.deleteMany({where:{meetingId:input.meetingId}})
        return await ctx.db.meeting.delete({where:{id:input.meetingId}})
    }),
    getMeetingById:protectedProcedure.input(z.object({meetingId:z.string()})).query(async({ctx,input})=>{
        return await ctx.db.meeting.findUnique({where:{id:input.meetingId},include:{issues:true}});
    }),
    archiveProject:protectedProcedure.input(z.object({projectId:z.string()})).mutation(async({ctx,input})=>{
        return await ctx.db.project.update({
            where:{
                id:input.projectId
            },
            data:{
                deletedAt:new Date()
            }
        })
    }),
    getTeamMembers:protectedProcedure.input(z.object({projectId:z.string()})).query(async({ctx,input})=>{
        return await ctx.db.userToProject.findMany({where:{projectId:input.projectId},include:{user:true}})
    }),
    getMyCredits:protectedProcedure.query(async({ctx})=>{
        return await ctx.db.user.findUnique({where:{id:ctx.user.userId!},select:{credits:true}})
    }),
    checkCredits:protectedProcedure.input(z.object({githubUrl:z.string(),githubToken:z.string().optional()})).mutation(async({ctx,input})=>{
        const fileCount= await checkCredits(input.githubUrl,input.githubToken);
        const userCredits=await ctx.db.user.findUnique({where:{id:ctx.user.userId!},select:{credits:true}})
        return {fileCount,userCredits: userCredits?.credits || 0}
    })
})