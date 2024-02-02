import mongoose from "mongoose";

const Schema = mongoose.Schema
// TODO: make support for images
const messageSchema = new Schema({
    chatId: { type: Schema.Types.ObjectId, required:true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    date: { type: Date, default: Date.now },
    text: { type: String , max: 500 },
})

const Message = mongoose.model('Message', messageSchema)

export default Message