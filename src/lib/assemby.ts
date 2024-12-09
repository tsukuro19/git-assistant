import {AssemblyAI} from "assemblyai"
import * as dotenv from 'dotenv';
import { start } from "repl";
dotenv.config({path: '../../.env'});

const client = new AssemblyAI({
    apiKey:process.env.ASSEMBLYAI_API_KEY!
})

function msToTime(ms:number){
    const second=ms/1000 //convert to seconds
    const minutes=Math.floor(second/60) //convert to minutes
    const remainingSeconds=Math.floor(second%60) //get the remaining seconds
    return `${minutes.toString().padStart(2,'0')}:${remainingSeconds.toString().padStart(2,'0')}`//return in HH:MM format
}

export const processMeeting=async (meetingUrl:string)=>{
    const transcript=await client.transcripts.create({
        audio_url:meetingUrl,
        auto_chapters:true
    })

    const summaries=transcript.chapters?.map(chapter=>({
        start:msToTime(chapter.start),
        end:msToTime(chapter.end),
        gist:chapter.gist,//An ultra-short summary (just a few words) of the content spoken in the chapter
        headline:chapter.headline,
        summary:chapter.summary
    })) || []
    if(!transcript.text) throw new Error("No transcript found");

    return {
        transcript,summaries
    };
}

