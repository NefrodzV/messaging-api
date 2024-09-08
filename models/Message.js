import mongoose from "mongoose";

const Schema = mongoose.Schema

const messageSchema = new Schema({
    chatId: { type: Schema.Types.ObjectId, required:true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now },
    text: { type: String , max: 500 },
    images: [{type: String}]
})

const Message = mongoose.model('Message', messageSchema)

export default Message