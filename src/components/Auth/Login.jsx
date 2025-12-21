const Login = () => {
  return (
    <div className="flex items-center justify-center h-screen w-screen">
      <div className="border-2 border-red-600">
        <form className="flex flex-col justify-center items-center">
          <input
            className="border-2 border-emerald-600 rounded-full py-3 px-5 text-xl text-black outline-none bg-transparent placeholder-text-white"
            type="email"
            placeholder="Enter your email"
          />
          <input
            className="border-2 border-emerald-600 rounded-full py-3 px-5 text-xl text-black mt-3"
            type="password"
            placeholder="Enter your password"
          />
          <button className="text-white border-emerald-600 rounded-full py-3 px-5 text-xl text-black outline-none bg-emerald-600 border-none placeholder-text-white">
            Log in
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
