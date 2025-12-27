const employees = [
  {
    id: "EMP001",
    email: "employee1@example.com",
    password: "123",
    tasks: [
      {
        title: "Fix login bug",
        description: "Resolve authentication issue on login page",
        date: "2025-01-10",
        category: "Development",
        active: true,
        newTask: true,
        completed: false,
        failed: false,
      },
      {
        title: "Update UI colors",
        description: "Modify dashboard color theme",
        date: "2025-01-08",
        category: "UI/UX",
        active: false,
        newTask: false,
        completed: true,
        failed: false,
      },
      {
        title: "Write API documentation",
        description: "Prepare API docs for employee module",
        date: "2025-01-05",
        category: "Documentation",
        active: false,
        newTask: false,
        completed: false,
        failed: true,
      },
    ],
  },
  {
    id: "EMP002",
    email: "employee2@example.com",
    password: "123",
    tasks: [
      {
        title: "Create signup page",
        description: "Design and implement signup UI",
        date: "2025-01-11",
        category: "Frontend",
        active: true,
        newTask: true,
        completed: false,
        failed: false,
      },
      {
        title: "Fix navbar bug",
        description: "Navbar not responsive on mobile",
        date: "2025-01-09",
        category: "Bug Fix",
        active: false,
        newTask: false,
        completed: true,
        failed: false,
      },
      {
        title: "Add form validation",
        description: "Add validation to registration form",
        date: "2025-01-06",
        category: "Frontend",
        active: false,
        newTask: false,
        completed: false,
        failed: true,
      },
      {
        title: "Optimize images",
        description: "Compress and optimize dashboard images",
        date: "2025-01-12",
        category: "Performance",
        active: true,
        newTask: true,
        completed: false,
        failed: false,
      },
    ],
  },
  {
    id: "EMP003",
    email: "employee3@example.com",
    password: "123",
    tasks: [
      {
        title: "Setup database schema",
        description: "Create collections and relations",
        date: "2025-01-07",
        category: "Backend",
        active: false,
        newTask: false,
        completed: true,
        failed: false,
      },
      {
        title: "Fix API timeout",
        description: "Investigate slow response issue",
        date: "2025-01-11",
        category: "Backend",
        active: true,
        newTask: true,
        completed: false,
        failed: false,
      },
      {
        title: "Write unit tests",
        description: "Add test cases for services",
        date: "2025-01-09",
        category: "Testing",
        active: false,
        newTask: false,
        completed: false,
        failed: true,
      },
    ],
  },
  {
    id: "EMP004",
    email: "employee4@example.com",
    password: "123",
    tasks: [
      {
        title: "Deploy staging build",
        description: "Deploy latest version to staging",
        date: "2025-01-10",
        category: "DevOps",
        active: true,
        newTask: true,
        completed: false,
        failed: false,
      },
      {
        title: "Fix CI pipeline",
        description: "Resolve failing GitHub actions",
        date: "2025-01-08",
        category: "DevOps",
        active: false,
        newTask: false,
        completed: true,
        failed: false,
      },
      {
        title: "Monitor logs",
        description: "Check error logs and alerts",
        date: "2025-01-06",
        category: "Monitoring",
        active: false,
        newTask: false,
        completed: false,
        failed: true,
      },
      {
        title: "Update environment vars",
        description: "Sync env variables across servers",
        date: "2025-01-12",
        category: "Configuration",
        active: true,
        newTask: true,
        completed: false,
        failed: false,
      },
    ],
  },
  {
    id: "EMP005",
    email: "employee5@example.com",
    password: "123",
    tasks: [
      {
        title: "Prepare project report",
        description: "Create weekly progress report",
        date: "2025-01-09",
        category: "Reporting",
        active: false,
        newTask: false,
        completed: true,
        failed: false,
      },
      {
        title: "Client feedback review",
        description: "Analyze feedback and suggestions",
        date: "2025-01-10",
        category: "Management",
        active: true,
        newTask: true,
        completed: false,
        failed: false,
      },
      {
        title: "Fix UI alignment",
        description: "Resolve alignment issues on dashboard",
        date: "2025-01-11",
        category: "UI/UX",
        active: false,
        newTask: false,
        completed: false,
        failed: true,
      },
    ],
  },
];

const admin = [
  {
    id: "ADMIN001",
    email: "admin@example.com",
    password: "123",
  },
];

// localStorage.clear();

export const setLocalStorage = () => {
    localStorage.setItem('employees', JSON.stringify(employees))
    localStorage.setItem('admin', JSON.stringify(admin));
}

export const getLocalStorage = () => {
    const employees = JSON.parse(localStorage.getItem('employees'))
    const admin = JSON.parse(localStorage.getItem("admin"));
    console.log(employees, admin)
}