import { useEffect } from "react";
import Login from "./components/Auth/Login";
import AdminDashboard from "./components/Dashboard/AdminDashboard";
import EmployeeDashboard from "./components/Dashboard/EmployeeDashboard";
import { getLocalStorage, setLocalStorage } from "./utils/localStorage";


const App = () => {
  // useEffect(() => {
  //   setLocalStorage();
  //   getLocalStorage();
  // },);

const [user, setUser] = useState(null)

const handleLogin = (email, password) => {
  if(email == 'admin@me.com' && password == '123'){
    setUser('admin')
    console.log(user);
    
  }
  else if (email == "user@me.com" && password == "123") {
    setUser("employee");
    console.log(user);
    
  } else {
    alert("Invalid Credentials");
  }
}

  return (
    <>
      {!user ? <Login handleLogin={handleLogin} /> : ''}
      {/* <EmployeeDashboard /> */}
      {/* <AdminDashboard /> */}
    </>
  );
};

export default App;
