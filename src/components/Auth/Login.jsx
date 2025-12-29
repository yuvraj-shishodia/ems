import React, { useState } from "react";

const Login = ({handleLogin}) => {


   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const submitHandler = (e) => {
     e.preventDefault();
     console.log("Email is:", email);
     console.log("Password is:", password);
     setEmail("");
      setPassword("");
   };

  return (
    <div className="flex items-center justify-center h-screen w-screen out">
      <div className="border-2 rounded-xl border-emerald-600 p-20">
        <form onSubmit={(e) => {
          submitHandler(e)}}
           className="flex flex-col justify-center items-center">
          <input
          value={email}
          onChange={(e)=>{
            setEmail(e.target.value);
          }}
          required
            className="border-2 border-emerald-600 rounded-full py-3 px-5 text-xl outline-none bg-transparent placeholder-text-gray-400"
            type="email"
            placeholder="Enter your email"
          />
          <input
          value={password}
          onChange={(e)=>{
            setPassword(e.target.value);
          }}
          required
            className="border-2 border-emerald-600 rounded-full py-3 px-5 text-xl mt-3 outline-none bg-transparent placeholder-text-gray-400"
            type="password"
            placeholder="Enter your password"
          />
          <button className="text-white rounded-full py-3 px-5 mt-5 text-xl outline-none bg-emerald-600 border-none">
            Log in
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
