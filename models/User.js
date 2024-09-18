import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const userSchema = new Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    lastChat: { type: mongoose.SchemaTypes.ObjectId },
    image: String,
});

const User = mongoose.model('User', userSchema);

export default User;
