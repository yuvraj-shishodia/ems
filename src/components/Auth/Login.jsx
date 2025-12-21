const Login = () => {
  return (
    <div className="flex items-center justify-center h-screen w-screen">
      <div className="border-2 border-red-600">
        <form className="flex flex-col justify-center items-center">
          <input type="email" placeholder="Enter your email" />
          <input type="password" placeholder="Enter your password" />
          <button>Log in</button>
        </form>
      </div>
    </div>
  );
};

export default Login;
