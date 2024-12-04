'use client'
import React from 'react'
import { useForm } from 'react-hook-form'

type FormInput = {
    repoUrl: string,
    projectName: string,
    githubToken?: string
}

const CreatePage = () => {
    const {register,handleSubmit,reset}=useForm<FormInput>();
    return (
        <div className='flex items-center gap-12 h-full justify-center '>
            
        </div>
    )
}

export default CreatePage