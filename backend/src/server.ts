import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from 'fs';
const os = require("os");
const pty = require("node-pty");

const { exec } = require('child_process'); 
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

const io = require('socket.io')(3000, {
    cors: {
        credentials: true,
        origin: ['http://localhost:4200']
    }
})

let i = 0;
const app = express();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended:true
}))

function createTempFileWithCode(code){
    return new Promise(function (resolve) {
        fs.writeFile('TempFiles/tempCode.cpp',code, function (err){
            if (err) throw err;
            resolve('File is created successfully.');
        });
    })
}

function createExectuableFile(){
    return new Promise(function (resolve, reject) {
        exec("g++ TempFiles/tempCode.cpp -o TempFiles/outputFile\r", (error, stdout, stderr) => {
            if (error) {
                reject(error.message);
            }
            else if (stderr) {
                reject(stderr);
            }
            else{
                resolve("Success!")
            }
        })
    })
}


io.on('connection', async socket => { 
    console.log("Connection Formed!")
    console.log(socket.id);

    let ptyProcess = pty.spawn(shell, [], {
        cwd: __dirname,
        env: process.env
    });
    
    socket.on("compile-code", async (code) => {
        await createTempFileWithCode(code);

        await createExectuableFile()
            .then(res => socket.emit("compile-code-msg", res))
            .catch(err => socket.emit("compile-code-msg", err));
    })

    socket.on("run-code", () => {
        ptyProcess.on('data', function (output){
            socket.emit("code-output", output)
        });
        ptyProcess.write("cls\r");
        ptyProcess.write("./TempFiles/outputFile.exe\r");
    })

    socket.on("send-input-value", (data) => {
        ptyProcess.write(data);
    });
})