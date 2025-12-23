const Login = () => {
  return (
    <div className="flex items-center justify-center h-screen w-screen">
      <div className="border-2 rounded-xl border-emerald-600 p-20">
        <form className="flex flex-col justify-center items-center">
          <input
            className="border-2 border-emerald-600 rounded-full py-3 px-5 text-xl outline-none bg-transparent placeholder-text-gray-400"
            type="email"
            placeholder="Enter your email"
          />
          <input
            className="border-2 border-emerald-600 rounded-full py-3 px-5 text-xl mt-3 outline-none bg-transparent placeholder-text-gray-400"
            type="password"
            placeholder="Enter your password"
          />
          <button className="text-white rounded-full py-3 px-5 mt-5 text-xl text-black outline-none bg-emerald-600 border-none placeholder-text-white">
            Log in
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
