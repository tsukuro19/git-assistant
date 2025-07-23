// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDownloadURL, getStorage, ref, uploadBytesResumable } from 'firebase/storage'
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries


// Your web app's Firebase configuration





// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app)

export async function uploadFile(file: File, setProgress?: (process: number) => void) {
    return new Promise((resolve, reject) => {
        try {
            const storageRef = ref(storage, file.name);//create a reference to the file in firebase storage    
            const uploadTask = uploadBytesResumable(storageRef, file);//upload file to firebase storage    
            uploadTask.on('state_changed', snapshot => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);//calculate progress
                if (setProgress) setProgress(progress)//update progress
                switch (snapshot.state) {
                    case 'paused':
                        console.log('Upload is paused');
                        break;
                    case 'running':
                        console.log('Upload is running');
                        break;
                }
            }, error => {
                reject(error)
            }, () => {
                getDownloadURL(uploadTask.snapshot.ref).then(downloadUrl => {
                    resolve(downloadUrl as string)
                })//get download url
            })
        } catch (e) {
            console.log(e);
            reject(e)
        }
    })
}
