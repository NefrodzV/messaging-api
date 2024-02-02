import mongoose from "mongoose";

const Schema = mongoose.Schema

const userSchema = new Schema({
    profile: {
        username: { type: String, required: true },
        password: { type: String, required:true },
        email: { type: String, required:true },
        image: { 
            name: String, 
            mimeType: String, 
            data: Buffer
        }
    },
    chats: [{ type: Schema.Types.ObjectId, ref: "Chat" }]
})

const User = mongoose.model('User', userSchema)

export default User