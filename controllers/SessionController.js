
function SessionController() {
    const login = (req, res) => {
        res.send('login user not implemeted')
    }

    const register = (req, res) => {
        res.send('register user no implemented')
    }

    return {
        register, 
        login
    }
}

export default SessionController