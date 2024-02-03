
function UserController() {

    const getUser =  async (req, res) => {
        res.send("Get user not implemented")
    }
    
    const getChats = (req, res) => {
        res.send("Get all user chats not implemented")
    }

    // Create a new chat with other user
    const createChat = (req, res) => {
        res.send('create new chat not implemented')
    }

    const getChat = (req, res) => {
        res.send('Get a specific user chat with chatId not implemented')
    }

    const createMessage = (req, res) => {
        res.send('Send a message in a specific chat not implemented')
    }

    return {
        getUser,
        getChats,
        getChat,
        createChat,
        createMessage
    }

}

export default UserController

