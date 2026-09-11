Created by 冯皓博, last modified on 二月 21, 2024

# 1、函数定义

```
SQLRETURN SQL_API SQLColumns(SQLHSTMT hStmt, SQLCHAR* catalog, SQLSMALLINT catalogLen, SQLCHAR* schema,
                             SQLSMALLINT schemaLen, SQLCHAR* table, SQLSMALLINT tableLen, SQLCHAR* column,
                             SQLSMALLINT columnLen)
```

# 2、函数调研

catalog忽略，重点调研剩余三个参数

|schema|table|column|结果|
|---|---|---|---|
|“”|“”|“”|  
|
|“”|“”|“%”|  
|
|“”|“”|正常|  
|
|“”|“%”|“”|  
|
|“”|“%”|“%”|  
|
|“”|“%”|正常|  
|
|“”|正常|“”|  
|
|“”|正常|“%”|  
|
|“”|正常|正常|  
|
|“%”|“”|“”|  
|
|“%”|“”|“%”|  
|
|“%”|“”|正常|  
|
|“%”|“%”|“”|  
|
|“%”|“%”|“%”|  
|
|“%”|“%”|正常|  
|
|“%”|正常|“”|  
|
|“%”|正常|“%”|  
|
|“%”|正常|正常|  
|
|正常|“”|“”|  
|
|正常|“”|“%”|  
|
|正常|“”|正常|  
|
|正常|“%”|“”|  
|
|正常|“%”|“%”|  
|
|正常|“%”|正常|  
|
|正常|正常|“”|  
|
|正常|正常|“%”|  
|
|正常|正常|正常|  
|
