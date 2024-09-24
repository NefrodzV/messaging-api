import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const chatSchema = new Schema({
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
});

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
