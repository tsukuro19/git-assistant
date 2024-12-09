'use client'
import MDEditor from '@uiw/react-md-editor'
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import useProject from '@/hooks/use-project'

import { set } from 'date-fns';
import Image from 'next/image';
import React from 'react'
import { askQuestion } from './action';
import { readStreamableValue } from 'ai/rsc';
import CodeReferences from './code-references';
import { api } from '@/trpc/react';
import { toast } from 'sonner';
import useRefetch from '@/hooks/use-refetch';

const AskQuestionCard = () => {
    const { project } = useProject();
    const [question, setQuestion] = React.useState('');
    const [open, setOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [fileReferences, setFileReferences] = React.useState<{ fileName: string, sourceCode: string, summary: string }[]>([]);
    const [answer, setAnswer] = React.useState('');
    const saveAnswer=api.project.saveAnswer.useMutation();


    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        setAnswer('');
        setFileReferences([]);
        e.preventDefault();
        if (!project?.id) return;
        setLoading(true);

        const { output, fileReferences } = await askQuestion(question, project.id);
        setOpen(true);
        setFileReferences(fileReferences);

        for await (const delta of readStreamableValue(output)) {
            if (delta) {
                setAnswer(ans => ans + delta);
            }
        }
        setLoading(false);
    }

    const refetch=useRefetch();

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className='sm:max-w-[80vw]'>
                    <DialogHeader>
                        <div className="flex items-center gap-2 ">
                            <DialogTitle>
                                <Image src='/bot-svgrepo-com.svg' width={40} height={40} alt='bot-icon' />
                            </DialogTitle>
                            <Button disabled={saveAnswer.isPending} variant={'outline'} onClick={()=>{
                                saveAnswer.mutate({
                                    projectId: project!.id,
                                    question,
                                    answer,
                                    fileReferences
                                },{
                                    onSuccess:()=>{
                                        toast.success('Answer saved successfully');
                                        refetch();
                                    },
                                    onError:()=>{
                                        toast.error('Failed to save answer');
                                    }
                                })
                                setOpen(false)
                            }}>
                                Save Answer
                            </Button>
                        </div>
                    </DialogHeader>
                    <div data-color-mode="light" className='overflow-scroll'>
                        <MDEditor.Markdown source={answer} className='max-w-[80vw] !h-full max-h-[30vh]' />
                    </div>
                    
                    <CodeReferences filesReferences={fileReferences} />
                    <Button type='button' onClick={() => { setOpen(false) }}>
                        Close
                    </Button>
                </DialogContent>
            </Dialog>
            <Card className='relative col-span-3'>
                <CardHeader>
                    <CardTitle>Ask a question</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={onSubmit}>
                        <Textarea placeholder='Which file should I edit to add a new feature?' value={question} onChange={(e) => setQuestion(e.target.value)} />
                        <div className='h-4'></div>
                        <Button type='submit' disabled={loading}>
                            Ask CodeWinning!
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </>
    )
}

export default AskQuestionCard