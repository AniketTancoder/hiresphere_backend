
const mongoose = require('mongoose');
const Skill = require('../models/Skill');
require('dotenv').config();

const skillsData = [
  // Programming Languages
  { name: 'javascript', displayName: 'JavaScript', category: 'programming_languages', popularity: 95, demand: 'very_high', aliases: ['js', 'ecmascript'], description: 'High-level programming language for web development' },
  { name: 'typescript', displayName: 'TypeScript', category: 'programming_languages', popularity: 85, demand: 'very_high', aliases: ['ts'], description: 'Typed superset of JavaScript' },
  { name: 'python', displayName: 'Python', category: 'programming_languages', popularity: 90, demand: 'very_high', aliases: ['py'], description: 'Versatile programming language for data science and web development' },
  { name: 'java', displayName: 'Java', category: 'programming_languages', popularity: 80, demand: 'high', aliases: [], description: 'Object-oriented programming language' },
  { name: 'c++', displayName: 'C++', category: 'programming_languages', popularity: 70, demand: 'high', aliases: ['cpp'], description: 'General-purpose programming language' },
  { name: 'c#', displayName: 'C#', category: 'programming_languages', popularity: 75, demand: 'high', aliases: ['csharp'], description: 'Modern object-oriented programming language' },
  { name: 'php', displayName: 'PHP', category: 'programming_languages', popularity: 65, demand: 'medium', aliases: [], description: 'Server-side scripting language' },
  { name: 'ruby', displayName: 'Ruby', category: 'programming_languages', popularity: 60, demand: 'medium', aliases: [], description: 'Dynamic programming language' },
  { name: 'go', displayName: 'Go', category: 'programming_languages', popularity: 70, demand: 'high', aliases: ['golang'], description: 'Compiled programming language by Google' },
  { name: 'rust', displayName: 'Rust', category: 'programming_languages', popularity: 65, demand: 'high', aliases: [], description: 'Systems programming language focused on safety' },
  { name: 'swift', displayName: 'Swift', category: 'programming_languages', popularity: 60, demand: 'medium', aliases: [], description: 'Programming language for iOS and macOS' },
  { name: 'kotlin', displayName: 'Kotlin', category: 'programming_languages', popularity: 70, demand: 'high', aliases: [], description: 'Modern programming language for JVM and Android' },
  { name: 'scala', displayName: 'Scala', category: 'programming_languages', popularity: 55, demand: 'medium', aliases: [], description: 'Functional programming language for JVM' },
  { name: 'r', displayName: 'R', category: 'programming_languages', popularity: 60, demand: 'medium', aliases: [], description: 'Programming language for statistical computing' },
  { name: 'dart', displayName: 'Dart', category: 'programming_languages', popularity: 50, demand: 'medium', aliases: [], description: 'Programming language for Flutter' },

  // Web Technologies
  { name: 'html', displayName: 'HTML', category: 'frameworks_libraries', popularity: 95, demand: 'very_high', aliases: ['html5'], description: 'Markup language for web pages' },
  { name: 'css', displayName: 'CSS', category: 'frameworks_libraries', popularity: 95, demand: 'very_high', aliases: ['css3'], description: 'Style sheet language for web pages' },
  { name: 'react', displayName: 'React', category: 'frameworks_libraries', popularity: 90, demand: 'very_high', aliases: ['react.js'], description: 'JavaScript library for building user interfaces' },
  { name: 'angular', displayName: 'Angular', category: 'frameworks_libraries', popularity: 75, demand: 'high', aliases: ['angularjs'], description: 'TypeScript-based web framework' },
  { name: 'vue.js', displayName: 'Vue.js', category: 'frameworks_libraries', popularity: 70, demand: 'high', aliases: ['vue'], description: 'Progressive JavaScript framework' },
  { name: 'node.js', displayName: 'Node.js', category: 'frameworks_libraries', popularity: 85, demand: 'very_high', aliases: ['nodejs'], description: 'JavaScript runtime for server-side development' },
  { name: 'express', displayName: 'Express.js', category: 'frameworks_libraries', popularity: 80, demand: 'high', aliases: ['express'], description: 'Web application framework for Node.js' },
  { name: 'django', displayName: 'Django', category: 'frameworks_libraries', popularity: 70, demand: 'high', aliases: [], description: 'High-level Python web framework' },
  { name: 'flask', displayName: 'Flask', category: 'frameworks_libraries', popularity: 65, demand: 'medium', aliases: [], description: 'Lightweight Python web framework' },
  { name: 'spring boot', displayName: 'Spring Boot', category: 'frameworks_libraries', popularity: 75, demand: 'high', aliases: ['spring'], description: 'Java framework for building web applications' },
  { name: 'laravel', displayName: 'Laravel', category: 'frameworks_libraries', popularity: 70, demand: 'high', aliases: [], description: 'PHP web framework' },
  { name: 'ruby on rails', displayName: 'Ruby on Rails', category: 'frameworks_libraries', popularity: 65, demand: 'medium', aliases: ['rails'], description: 'Full-stack web framework for Ruby' },
  { name: 'asp.net', displayName: 'ASP.NET', category: 'frameworks_libraries', popularity: 60, demand: 'medium', aliases: ['asp.net core'], description: 'Web framework for .NET' },
  { name: 'jquery', displayName: 'jQuery', category: 'frameworks_libraries', popularity: 70, demand: 'medium', aliases: [], description: 'JavaScript library for DOM manipulation' },
  { name: 'bootstrap', displayName: 'Bootstrap', category: 'frameworks_libraries', popularity: 80, demand: 'high', aliases: [], description: 'CSS framework for responsive web design' },

  // Databases
  { name: 'mongodb', displayName: 'MongoDB', category: 'databases', popularity: 80, demand: 'very_high', aliases: [], description: 'NoSQL document database' },
  { name: 'mysql', displayName: 'MySQL', category: 'databases', popularity: 75, demand: 'high', aliases: [], description: 'Open-source relational database' },
  { name: 'postgresql', displayName: 'PostgreSQL', category: 'databases', popularity: 70, demand: 'high', aliases: ['postgres'], description: 'Advanced open-source relational database' },
  { name: 'sql server', displayName: 'SQL Server', category: 'databases', popularity: 65, demand: 'medium', aliases: ['mssql'], description: 'Microsoft relational database' },
  { name: 'oracle', displayName: 'Oracle', category: 'databases', popularity: 60, demand: 'medium', aliases: [], description: 'Enterprise relational database' },
  { name: 'redis', displayName: 'Redis', category: 'databases', popularity: 75, demand: 'high', aliases: [], description: 'In-memory data structure store' },
  { name: 'elasticsearch', displayName: 'Elasticsearch', category: 'databases', popularity: 70, demand: 'high', aliases: [], description: 'Search and analytics engine' },
  { name: 'firebase', displayName: 'Firebase', category: 'databases', popularity: 70, demand: 'high', aliases: ['firestore'], description: 'Google cloud database service' },
  { name: 'dynamodb', displayName: 'DynamoDB', category: 'databases', popularity: 65, demand: 'high', aliases: [], description: 'AWS NoSQL database' },
  { name: 'cassandra', displayName: 'Cassandra', category: 'databases', popularity: 55, demand: 'medium', aliases: [], description: 'Distributed NoSQL database' },

  // Cloud Platforms
  { name: 'aws', displayName: 'AWS', category: 'devops_cloud', popularity: 90, demand: 'very_high', aliases: ['amazon web services'], description: 'Amazon cloud computing platform' },
  { name: 'azure', displayName: 'Azure', category: 'devops_cloud', popularity: 80, demand: 'very_high', aliases: [], description: 'Microsoft cloud computing platform' },
  { name: 'google cloud platform', displayName: 'Google Cloud Platform', category: 'devops_cloud', popularity: 75, demand: 'high', aliases: ['gcp'], description: 'Google cloud computing platform' },
  { name: 'docker', displayName: 'Docker', category: 'devops_cloud', popularity: 85, demand: 'very_high', aliases: [], description: 'Containerization platform' },
  { name: 'kubernetes', displayName: 'Kubernetes', category: 'devops_cloud', popularity: 80, demand: 'very_high', aliases: ['k8s'], description: 'Container orchestration platform' },
  { name: 'terraform', displayName: 'Terraform', category: 'devops_cloud', popularity: 75, demand: 'high', aliases: [], description: 'Infrastructure as code tool' },
  { name: 'jenkins', displayName: 'Jenkins', category: 'devops_cloud', popularity: 70, demand: 'high', aliases: [], description: 'Continuous integration tool' },
  { name: 'github actions', displayName: 'GitHub Actions', category: 'devops_cloud', popularity: 75, demand: 'high', aliases: [], description: 'CI/CD platform' },
  { name: 'gitlab ci', displayName: 'GitLab CI', category: 'devops_cloud', popularity: 65, demand: 'medium', aliases: [], description: 'Continuous integration platform' },

  // Version Control
  { name: 'git', displayName: 'Git', category: 'tools_platforms', popularity: 95, demand: 'very_high', aliases: [], description: 'Distributed version control system' },
  { name: 'github', displayName: 'GitHub', category: 'tools_platforms', popularity: 90, demand: 'very_high', aliases: [], description: 'Code hosting platform' },
  { name: 'gitlab', displayName: 'GitLab', category: 'tools_platforms', popularity: 70, demand: 'high', aliases: [], description: 'DevOps platform' },
  { name: 'bitbucket', displayName: 'Bitbucket', category: 'tools_platforms', popularity: 60, demand: 'medium', aliases: [], description: 'Git repository hosting service' },

  // Testing
  { name: 'jest', displayName: 'Jest', category: 'testing', popularity: 80, demand: 'high', aliases: [], description: 'JavaScript testing framework' },
  { name: 'selenium', displayName: 'Selenium', category: 'testing', popularity: 70, demand: 'high', aliases: [], description: 'Web application testing framework' },
  { name: 'cypress', displayName: 'Cypress', category: 'testing', popularity: 75, demand: 'high', aliases: [], description: 'End-to-end testing framework' },
  { name: 'junit', displayName: 'JUnit', category: 'testing', popularity: 65, demand: 'medium', aliases: [], description: 'Java testing framework' },
  { name: 'pytest', displayName: 'pytest', category: 'testing', popularity: 70, demand: 'high', aliases: [], description: 'Python testing framework' },

  // Data Science & ML
  { name: 'machine learning', displayName: 'Machine Learning', category: 'data_science', popularity: 80, demand: 'very_high', aliases: ['ml'], description: 'AI technique for pattern recognition' },
  { name: 'tensorflow', displayName: 'TensorFlow', category: 'data_science', popularity: 75, demand: 'high', aliases: [], description: 'Open-source machine learning framework' },
  { name: 'pytorch', displayName: 'PyTorch', category: 'data_science', popularity: 75, demand: 'high', aliases: [], description: 'Open-source machine learning library' },
  { name: 'pandas', displayName: 'Pandas', category: 'data_science', popularity: 80, demand: 'high', aliases: [], description: 'Python data analysis library' },
  { name: 'numpy', displayName: 'NumPy', category: 'data_science', popularity: 75, demand: 'high', aliases: [], description: 'Python numerical computing library' },
  { name: 'scikit-learn', displayName: 'scikit-learn', category: 'data_science', popularity: 70, demand: 'high', aliases: ['sklearn'], description: 'Python machine learning library' },

  // Soft Skills
  { name: 'project management', displayName: 'Project Management', category: 'soft_skills', popularity: 80, demand: 'high', aliases: ['pm'], description: 'Planning and executing projects' },
  { name: 'agile', displayName: 'Agile', category: 'soft_skills', popularity: 85, demand: 'very_high', aliases: [], description: 'Flexible project management methodology' },
  { name: 'scrum', displayName: 'Scrum', category: 'soft_skills', popularity: 80, demand: 'high', aliases: [], description: 'Agile framework for project management' },
  { name: 'leadership', displayName: 'Leadership', category: 'soft_skills', popularity: 85, demand: 'very_high', aliases: [], description: 'Ability to guide and influence others' },
  { name: 'communication', displayName: 'Communication', category: 'soft_skills', popularity: 90, demand: 'very_high', aliases: [], description: 'Effective verbal and written communication' },
  { name: 'teamwork', displayName: 'Teamwork', category: 'soft_skills', popularity: 85, demand: 'very_high', aliases: ['collaboration'], description: 'Working effectively with others' },
  { name: 'problem solving', displayName: 'Problem Solving', category: 'soft_skills', popularity: 85, demand: 'very_high', aliases: [], description: 'Analyzing and resolving complex issues' },
  { name: 'critical thinking', displayName: 'Critical Thinking', category: 'soft_skills', popularity: 80, demand: 'high', aliases: [], description: 'Objective analysis and evaluation' },

  // Design
  { name: 'ui/ux design', displayName: 'UI/UX Design', category: 'design', popularity: 75, demand: 'high', aliases: ['user interface design', 'user experience design'], description: 'Designing user interfaces and experiences' },
  { name: 'figma', displayName: 'Figma', category: 'design', popularity: 80, demand: 'high', aliases: [], description: 'Collaborative interface design tool' },
  { name: 'adobe photoshop', displayName: 'Adobe Photoshop', category: 'design', popularity: 70, demand: 'medium', aliases: ['photoshop'], description: 'Image editing software' },
  { name: 'adobe illustrator', displayName: 'Adobe Illustrator', category: 'design', popularity: 65, demand: 'medium', aliases: ['illustrator'], description: 'Vector graphics editor' },
  { name: 'sketch', displayName: 'Sketch', category: 'design', popularity: 60, demand: 'medium', aliases: [], description: 'Digital design toolkit' },

  // Mobile Development
  { name: 'react native', displayName: 'React Native', category: 'mobile', popularity: 75, demand: 'high', aliases: [], description: 'Framework for building native mobile apps' },
  { name: 'flutter', displayName: 'Flutter', category: 'mobile', popularity: 70, demand: 'high', aliases: [], description: 'UI toolkit for building natively compiled applications' },
  { name: 'swift', displayName: 'Swift', category: 'mobile', popularity: 65, demand: 'medium', aliases: [], description: 'Programming language for iOS development' },
  { name: 'kotlin', displayName: 'Kotlin', category: 'mobile', popularity: 70, demand: 'high', aliases: [], description: 'Programming language for Android development' },
  { name: 'android sdk', displayName: 'Android SDK', category: 'mobile', popularity: 70, demand: 'high', aliases: [], description: 'Software development kit for Android' },
  { name: 'ios sdk', displayName: 'iOS SDK', category: 'mobile', popularity: 65, demand: 'medium', aliases: [], description: 'Software development kit for iOS' },

  // Security
  { name: 'cybersecurity', displayName: 'Cybersecurity', category: 'security', popularity: 75, demand: 'very_high', aliases: [], description: 'Protection of computer systems from threats' },
  { name: 'penetration testing', displayName: 'Penetration Testing', category: 'security', popularity: 70, demand: 'high', aliases: ['pentesting'], description: 'Simulated cyber attacks to find vulnerabilities' },
  { name: 'ethical hacking', displayName: 'Ethical Hacking', category: 'security', popularity: 65, demand: 'high', aliases: [], description: 'Authorized hacking to improve security' },
  { name: 'owasp', displayName: 'OWASP', category: 'security', popularity: 60, demand: 'medium', aliases: [], description: 'Open Web Application Security Project' },
  { name: 'ssl/tls', displayName: 'SSL/TLS', category: 'security', popularity: 70, demand: 'high', aliases: [], description: 'Protocols for secure communication' },

  // DevOps Tools (additional)
  { name: 'ansible', displayName: 'Ansible', category: 'devops_cloud', popularity: 70, demand: 'high', aliases: [], description: 'Configuration management tool' },
  { name: 'puppet', displayName: 'Puppet', category: 'devops_cloud', popularity: 55, demand: 'medium', aliases: [], description: 'Configuration management tool' },
  { name: 'chef', displayName: 'Chef', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Configuration management tool' },
  { name: 'prometheus', displayName: 'Prometheus', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'Monitoring and alerting toolkit' },
  { name: 'grafana', displayName: 'Grafana', category: 'devops_cloud', popularity: 70, demand: 'high', aliases: [], description: 'Analytics and monitoring platform' },

  // Additional Programming Languages
  { name: 'clojure', displayName: 'Clojure', category: 'programming_languages', popularity: 45, demand: 'low', aliases: [], description: 'Functional programming language' },
  { name: 'haskell', displayName: 'Haskell', category: 'programming_languages', popularity: 40, demand: 'low', aliases: [], description: 'Purely functional programming language' },
  { name: 'erlang', displayName: 'Erlang', category: 'programming_languages', popularity: 45, demand: 'low', aliases: [], description: 'Concurrent programming language' },
  { name: 'elixir', displayName: 'Elixir', category: 'programming_languages', popularity: 50, demand: 'medium', aliases: [], description: 'Functional programming language for Erlang VM' },
  { name: 'lua', displayName: 'Lua', category: 'programming_languages', popularity: 50, demand: 'medium', aliases: [], description: 'Lightweight scripting language' },
  { name: 'perl', displayName: 'Perl', category: 'programming_languages', popularity: 40, demand: 'low', aliases: [], description: 'High-level programming language' },
  { name: 'matlab', displayName: 'MATLAB', category: 'programming_languages', popularity: 55, demand: 'medium', aliases: [], description: 'Numerical computing environment' },
  { name: 'sas', displayName: 'SAS', category: 'programming_languages', popularity: 45, demand: 'low', aliases: [], description: 'Statistical software' },
  { name: 'stata', displayName: 'Stata', category: 'programming_languages', popularity: 40, demand: 'low', aliases: [], description: 'Statistical software' },
  { name: 'cobol', displayName: 'COBOL', category: 'programming_languages', popularity: 30, demand: 'low', aliases: [], description: 'Business-oriented programming language' },
  { name: 'fortran', displayName: 'Fortran', category: 'programming_languages', popularity: 35, demand: 'low', aliases: [], description: 'Numerical and scientific computing language' },
  { name: 'pascal', displayName: 'Pascal', category: 'programming_languages', popularity: 30, demand: 'low', aliases: [], description: 'Imperative programming language' },
  { name: 'ada', displayName: 'Ada', category: 'programming_languages', popularity: 25, demand: 'low', aliases: [], description: 'Structured programming language' },
  { name: 'assembly', displayName: 'Assembly', category: 'programming_languages', popularity: 40, demand: 'low', aliases: ['asm'], description: 'Low-level programming language' },
  { name: 'bash', displayName: 'Bash', category: 'programming_languages', popularity: 65, demand: 'medium', aliases: ['shell scripting'], description: 'Unix shell and command language' },
  { name: 'powershell', displayName: 'PowerShell', category: 'programming_languages', popularity: 60, demand: 'medium', aliases: [], description: 'Task automation and configuration management' },
  { name: 'sql', displayName: 'SQL', category: 'programming_languages', popularity: 85, demand: 'very_high', aliases: ['structured query language'], description: 'Domain-specific language for database queries' },
  { name: 'pl/sql', displayName: 'PL/SQL', category: 'programming_languages', popularity: 50, demand: 'medium', aliases: [], description: 'Procedural extension to SQL' },
  { name: 't-sql', displayName: 'T-SQL', category: 'programming_languages', popularity: 55, demand: 'medium', aliases: [], description: 'Microsoft SQL Server extension to SQL' },

  // Additional Web Technologies
  { name: 'sass', displayName: 'SASS', category: 'frameworks_libraries', popularity: 70, demand: 'high', aliases: ['scss'], description: 'CSS preprocessor' },
  { name: 'less', displayName: 'LESS', category: 'frameworks_libraries', popularity: 50, demand: 'medium', aliases: [], description: 'CSS preprocessor' },
  { name: 'tailwind css', displayName: 'Tailwind CSS', category: 'frameworks_libraries', popularity: 75, demand: 'high', aliases: ['tailwind'], description: 'Utility-first CSS framework' },
  { name: 'material ui', displayName: 'Material UI', category: 'frameworks_libraries', popularity: 70, demand: 'high', aliases: ['mui'], description: 'React components implementing Material Design' },
  { name: 'redux', displayName: 'Redux', category: 'frameworks_libraries', popularity: 75, demand: 'high', aliases: [], description: 'Predictable state container for JavaScript apps' },
  { name: 'vuex', displayName: 'Vuex', category: 'frameworks_libraries', popularity: 60, demand: 'medium', aliases: [], description: 'State management pattern for Vue.js' },
  { name: 'ngrx', displayName: 'NgRx', category: 'frameworks_libraries', popularity: 55, demand: 'medium', aliases: [], description: 'Reactive state management for Angular' },
  { name: 'mobx', displayName: 'MobX', category: 'frameworks_libraries', popularity: 50, demand: 'medium', aliases: [], description: 'Simple, scalable state management' },
  { name: 'zustand', displayName: 'Zustand', category: 'frameworks_libraries', popularity: 45, demand: 'medium', aliases: [], description: 'Small, fast state management for React' },
  { name: 'context api', displayName: 'Context API', category: 'frameworks_libraries', popularity: 65, demand: 'medium', aliases: [], description: 'React API for sharing state' },
  { name: 'rest api', displayName: 'REST API', category: 'frameworks_libraries', popularity: 85, demand: 'very_high', aliases: [], description: 'Architectural style for web services' },
  { name: 'graphql', displayName: 'GraphQL', category: 'frameworks_libraries', popularity: 75, demand: 'high', aliases: [], description: 'Query language for APIs' },
  { name: 'apollo', displayName: 'Apollo', category: 'frameworks_libraries', popularity: 65, demand: 'high', aliases: [], description: 'GraphQL implementation' },
  { name: 'json', displayName: 'JSON', category: 'frameworks_libraries', popularity: 90, demand: 'very_high', aliases: [], description: 'Data interchange format' },
  { name: 'xml', displayName: 'XML', category: 'frameworks_libraries', popularity: 60, demand: 'medium', aliases: [], description: 'Markup language for data storage' },
  { name: 'ajax', displayName: 'AJAX', category: 'frameworks_libraries', popularity: 70, demand: 'medium', aliases: ['asynchronous javascript'], description: 'Technique for creating interactive web apps' },

  // Additional Backend Frameworks
  { name: 'koa', displayName: 'Koa.js', category: 'frameworks_libraries', popularity: 50, demand: 'medium', aliases: ['koa'], description: 'Next generation web framework for Node.js' },
  { name: 'hapi', displayName: 'Hapi.js', category: 'frameworks_libraries', popularity: 45, demand: 'low', aliases: ['hapi'], description: 'Rich framework for building web apps and services' },
  { name: 'fastify', displayName: 'Fastify', category: 'frameworks_libraries', popularity: 55, demand: 'medium', aliases: [], description: 'Fast and low overhead web framework for Node.js' },
  { name: 'meteor', displayName: 'Meteor', category: 'frameworks_libraries', popularity: 40, demand: 'low', aliases: [], description: 'Full-stack JavaScript platform' },
  { name: 'sails.js', displayName: 'Sails.js', category: 'frameworks_libraries', popularity: 45, demand: 'low', aliases: ['sails'], description: 'MVC framework for Node.js' },
  { name: 'fastapi', displayName: 'FastAPI', category: 'frameworks_libraries', popularity: 65, demand: 'high', aliases: [], description: 'Modern, fast web framework for Python' },
  { name: 'tornado', displayName: 'Tornado', category: 'frameworks_libraries', popularity: 40, demand: 'low', aliases: [], description: 'Python web framework and asynchronous networking library' },
  { name: 'bottle', displayName: 'Bottle', category: 'frameworks_libraries', popularity: 35, demand: 'low', aliases: [], description: 'Fast, simple and lightweight WSGI micro web-framework' },
  { name: 'pyramid', displayName: 'Pyramid', category: 'frameworks_libraries', popularity: 40, demand: 'low', aliases: [], description: 'Python web framework' },
  { name: 'web2py', displayName: 'web2py', category: 'frameworks_libraries', popularity: 35, demand: 'low', aliases: [], description: 'Full-stack web framework for Python' },
  { name: 'jpa', displayName: 'JPA', category: 'frameworks_libraries', popularity: 60, demand: 'medium', aliases: ['java persistence api'], description: 'Java specification for ORM' },
  { name: 'hibernate', displayName: 'Hibernate', category: 'frameworks_libraries', popularity: 65, demand: 'medium', aliases: [], description: 'Java ORM framework' },
  { name: 'struts', displayName: 'Struts', category: 'frameworks_libraries', popularity: 40, demand: 'low', aliases: [], description: 'MVC framework for Java' },
  { name: 'jsf', displayName: 'JSF', category: 'frameworks_libraries', popularity: 45, demand: 'low', aliases: ['java server faces'], description: 'Java specification for building component-based web interfaces' },
  { name: 'play framework', displayName: 'Play Framework', category: 'frameworks_libraries', popularity: 50, demand: 'medium', aliases: [], description: 'Reactive web framework for Java and Scala' },
  { name: 'symfony', displayName: 'Symfony', category: 'frameworks_libraries', popularity: 60, demand: 'medium', aliases: [], description: 'PHP web application framework' },
  { name: 'codeigniter', displayName: 'CodeIgniter', category: 'frameworks_libraries', popularity: 50, demand: 'medium', aliases: [], description: 'PHP web framework' },
  { name: 'cakephp', displayName: 'CakePHP', category: 'frameworks_libraries', popularity: 45, demand: 'low', aliases: [], description: 'PHP web framework' },
  { name: 'zend', displayName: 'Zend', category: 'frameworks_libraries', popularity: 40, demand: 'low', aliases: [], description: 'PHP web framework' },
  { name: 'slim', displayName: 'Slim', category: 'frameworks_libraries', popularity: 45, demand: 'low', aliases: [], description: 'PHP micro framework' },
  { name: 'lumen', displayName: 'Lumen', category: 'frameworks_libraries', popularity: 50, demand: 'medium', aliases: [], description: 'PHP micro-framework by Laravel' },
  { name: 'sinatra', displayName: 'Sinatra', category: 'frameworks_libraries', popularity: 40, demand: 'low', aliases: [], description: 'DSL for quickly creating web applications in Ruby' },
  { name: 'hanami', displayName: 'Hanami', category: 'frameworks_libraries', popularity: 35, demand: 'low', aliases: [], description: 'Web framework for Ruby' },
  { name: 'roda', displayName: 'Roda', category: 'frameworks_libraries', popularity: 30, demand: 'low', aliases: [], description: 'Routing tree web toolkit for Ruby' },
  { name: 'asp.net core', displayName: 'ASP.NET Core', category: 'frameworks_libraries', popularity: 65, demand: 'high', aliases: [], description: 'Cross-platform .NET framework' },
  { name: 'asp.net mvc', displayName: 'ASP.NET MVC', category: 'frameworks_libraries', popularity: 55, demand: 'medium', aliases: [], description: 'Model-view-controller framework for ASP.NET' },
  { name: 'entity framework', displayName: 'Entity Framework', category: 'frameworks_libraries', popularity: 60, demand: 'medium', aliases: ['ef'], description: '.NET ORM framework' },
  { name: 'nhibernate', displayName: 'NHibernate', category: 'frameworks_libraries', popularity: 40, demand: 'low', aliases: [], description: '.NET ORM framework' },

  // Additional Databases
  { name: 'sqlite', displayName: 'SQLite', category: 'databases', popularity: 70, demand: 'medium', aliases: [], description: 'Self-contained, file-based SQL database' },
  { name: 'couchdb', displayName: 'CouchDB', category: 'databases', popularity: 45, demand: 'low', aliases: [], description: 'Document-oriented NoSQL database' },
  { name: 'arangodb', displayName: 'ArangoDB', category: 'databases', popularity: 40, demand: 'low', aliases: [], description: 'Multi-model NoSQL database' },
  { name: 'realm', displayName: 'Realm', category: 'databases', popularity: 50, demand: 'medium', aliases: [], description: 'Mobile database' },
  { name: 'mariadb', displayName: 'MariaDB', category: 'databases', popularity: 55, demand: 'medium', aliases: [], description: 'Community-developed fork of MySQL' },
  { name: 'db2', displayName: 'DB2', category: 'databases', popularity: 45, demand: 'low', aliases: [], description: 'IBM relational database' },
  { name: 'informix', displayName: 'Informix', category: 'databases', popularity: 35, demand: 'low', aliases: [], description: 'IBM relational database' },
  { name: 'teradata', displayName: 'Teradata', category: 'databases', popularity: 40, demand: 'low', aliases: [], description: 'MPP relational database' },
  { name: 'snowflake', displayName: 'Snowflake', category: 'databases', popularity: 65, demand: 'high', aliases: [], description: 'Cloud data warehouse' },
  { name: 'bigquery', displayName: 'BigQuery', category: 'databases', popularity: 70, demand: 'high', aliases: [], description: 'Google Cloud data warehouse' },
  { name: 'redshift', displayName: 'Redshift', category: 'databases', popularity: 60, demand: 'medium', aliases: [], description: 'AWS data warehouse' },
  { name: 'aurora', displayName: 'Aurora', category: 'databases', popularity: 65, demand: 'high', aliases: [], description: 'AWS relational database' },
  { name: 'neo4j', displayName: 'Neo4j', category: 'databases', popularity: 55, demand: 'medium', aliases: [], description: 'Graph database' },
  { name: 'solr', displayName: 'Solr', category: 'databases', popularity: 50, demand: 'medium', aliases: [], description: 'Search and analytics engine' },
  { name: 'hbase', displayName: 'HBase', category: 'databases', popularity: 45, demand: 'low', aliases: [], description: 'Distributed, scalable big data store' },
  { name: 'hive', displayName: 'Hive', category: 'databases', popularity: 55, demand: 'medium', aliases: [], description: 'Data warehouse software for Hadoop' },
  { name: 'pig', displayName: 'Pig', category: 'databases', popularity: 40, demand: 'low', aliases: [], description: 'Platform for analyzing large data sets' },
  { name: 'presto', displayName: 'Presto', category: 'databases', popularity: 50, demand: 'medium', aliases: [], description: 'Distributed SQL query engine' },
  { name: 'druid', displayName: 'Druid', category: 'databases', popularity: 45, demand: 'low', aliases: [], description: 'Real-time analytics database' },
  { name: 'kudu', displayName: 'Kudu', category: 'databases', popularity: 35, demand: 'low', aliases: [], description: 'Storage engine for Hadoop' },
  { name: 'couchbase', displayName: 'Couchbase', category: 'databases', popularity: 50, demand: 'medium', aliases: [], description: 'NoSQL document-oriented database' },
  { name: 'riak', displayName: 'Riak', category: 'databases', popularity: 35, demand: 'low', aliases: [], description: 'Distributed NoSQL key-value database' },
  { name: 'influxdb', displayName: 'InfluxDB', category: 'databases', popularity: 55, demand: 'medium', aliases: [], description: 'Time series database' },
  { name: 'timescaledb', displayName: 'TimescaleDB', category: 'databases', popularity: 45, demand: 'low', aliases: [], description: 'Time-series SQL database' },
  { name: 'clickhouse', displayName: 'ClickHouse', category: 'databases', popularity: 50, demand: 'medium', aliases: [], description: 'Column-oriented database management system' },
  { name: 'vertica', displayName: 'Vertica', category: 'databases', popularity: 40, demand: 'low', aliases: [], description: 'Columnar analytic database' },
  { name: 'greenplum', displayName: 'Greenplum', category: 'databases', popularity: 35, demand: 'low', aliases: [], description: 'MPP database based on PostgreSQL' },

  // Additional Cloud Platforms
  { name: 'digitalocean', displayName: 'DigitalOcean', category: 'devops_cloud', popularity: 60, demand: 'medium', aliases: [], description: 'Cloud infrastructure provider' },
  { name: 'heroku', displayName: 'Heroku', category: 'devops_cloud', popularity: 65, demand: 'medium', aliases: [], description: 'Cloud platform as a service' },
  { name: 'vercel', displayName: 'Vercel', category: 'devops_cloud', popularity: 70, demand: 'high', aliases: [], description: 'Frontend cloud platform' },
  { name: 'netlify', displayName: 'Netlify', category: 'devops_cloud', popularity: 70, demand: 'high', aliases: [], description: 'Web hosting and automation platform' },
  { name: 'linode', displayName: 'Linode', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Cloud hosting provider' },
  { name: 'vultr', displayName: 'Vultr', category: 'devops_cloud', popularity: 45, demand: 'low', aliases: [], description: 'Cloud computing platform' },
  { name: 'ibm cloud', displayName: 'IBM Cloud', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Cloud computing platform' },
  { name: 'oracle cloud', displayName: 'Oracle Cloud', category: 'devops_cloud', popularity: 55, demand: 'medium', aliases: [], description: 'Cloud computing platform' },
  { name: 'alibaba cloud', displayName: 'Alibaba Cloud', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Cloud computing platform' },
  { name: 'tencent cloud', displayName: 'Tencent Cloud', category: 'devops_cloud', popularity: 45, demand: 'low', aliases: [], description: 'Cloud computing platform' },
  { name: 'ec2', displayName: 'EC2', category: 'devops_cloud', popularity: 85, demand: 'very_high', aliases: [], description: 'AWS Elastic Compute Cloud' },
  { name: 's3', displayName: 'S3', category: 'devops_cloud', popularity: 90, demand: 'very_high', aliases: [], description: 'AWS Simple Storage Service' },
  { name: 'lambda', displayName: 'Lambda', category: 'devops_cloud', popularity: 80, demand: 'very_high', aliases: [], description: 'AWS serverless compute service' },
  { name: 'api gateway', displayName: 'API Gateway', category: 'devops_cloud', popularity: 75, demand: 'high', aliases: [], description: 'AWS API management service' },
  { name: 'cloudformation', displayName: 'CloudFormation', category: 'devops_cloud', popularity: 70, demand: 'high', aliases: [], description: 'AWS infrastructure as code' },
  { name: 'azure functions', displayName: 'Azure Functions', category: 'devops_cloud', popularity: 70, demand: 'high', aliases: [], description: 'Azure serverless compute service' },
  { name: 'azure app service', displayName: 'Azure App Service', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'Azure web app hosting service' },
  { name: 'azure sql database', displayName: 'Azure SQL Database', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'Azure managed SQL database' },
  { name: 'azure cosmos db', displayName: 'Azure Cosmos DB', category: 'devops_cloud', popularity: 60, demand: 'high', aliases: [], description: 'Azure globally distributed database' },
  { name: 'app engine', displayName: 'App Engine', category: 'devops_cloud', popularity: 60, demand: 'medium', aliases: [], description: 'GCP serverless application platform' },
  { name: 'cloud functions', displayName: 'Cloud Functions', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'GCP serverless compute service' },
  { name: 'cloud storage', displayName: 'Cloud Storage', category: 'devops_cloud', popularity: 75, demand: 'high', aliases: [], description: 'GCP object storage service' },
  { name: 'kubernetes engine', displayName: 'Kubernetes Engine', category: 'devops_cloud', popularity: 70, demand: 'high', aliases: ['gke'], description: 'GCP managed Kubernetes service' },

  // Additional DevOps Tools
  { name: 'circleci', displayName: 'CircleCI', category: 'devops_cloud', popularity: 60, demand: 'medium', aliases: [], description: 'Continuous integration platform' },
  { name: 'travis ci', displayName: 'Travis CI', category: 'devops_cloud', popularity: 55, demand: 'medium', aliases: [], description: 'Continuous integration service' },
  { name: 'bitbucket pipelines', displayName: 'Bitbucket Pipelines', category: 'devops_cloud', popularity: 55, demand: 'medium', aliases: [], description: 'CI/CD service for Bitbucket' },
  { name: 'azure devops', displayName: 'Azure DevOps', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'DevOps service by Microsoft' },
  { name: 'bamboo', displayName: 'Bamboo', category: 'devops_cloud', popularity: 45, demand: 'low', aliases: [], description: 'Continuous integration server by Atlassian' },
  { name: 'teamcity', displayName: 'TeamCity', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Continuous integration server by JetBrains' },
  { name: 'pulumi', displayName: 'Pulumi', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Infrastructure as code platform' },
  { name: 'vagrant', displayName: 'Vagrant', category: 'devops_cloud', popularity: 55, demand: 'medium', aliases: [], description: 'Tool for building virtual development environments' },
  { name: 'packer', displayName: 'Packer', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Tool for creating identical machine images' },
  { name: 'elk stack', displayName: 'ELK Stack', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'Elasticsearch, Logstash, Kibana stack' },
  { name: 'logstash', displayName: 'Logstash', category: 'devops_cloud', popularity: 60, demand: 'medium', aliases: [], description: 'Data processing pipeline' },
  { name: 'kibana', displayName: 'Kibana', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'Data visualization for Elasticsearch' },
  { name: 'splunk', displayName: 'Splunk', category: 'devops_cloud', popularity: 60, demand: 'medium', aliases: [], description: 'Data analytics and monitoring platform' },
  { name: 'nagios', displayName: 'Nagios', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Computer system monitoring tool' },
  { name: 'zabbix', displayName: 'Zabbix', category: 'devops_cloud', popularity: 50, demand: 'medium', aliases: [], description: 'Enterprise-class monitoring solution' },
  { name: 'datadog', displayName: 'Datadog', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'Monitoring and analytics platform' },
  { name: 'new relic', displayName: 'New Relic', category: 'devops_cloud', popularity: 65, demand: 'high', aliases: [], description: 'Application performance monitoring' },
  { name: 'appdynamics', displayName: 'AppDynamics', category: 'devops_cloud', popularity: 55, demand: 'medium', aliases: [], description: 'Application performance management' }
];

async function seedSkills() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/talentsphere');

    console.log('Clearing existing skills...');
    await Skill.deleteMany({});

    console.log('Seeding skills...');
    const skills = await Skill.insertMany(skillsData);
    console.log(`Successfully seeded ${skills.length} skills`);

    console.log('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('Done!');
  } catch (error) {
    console.error('Error seeding skills:', error);
    process.exit(1);
  }
}

seedSkills();