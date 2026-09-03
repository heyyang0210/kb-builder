Created by 冯皓博, last modified on 七月 16, 2024

  [https://pingcode.yasdb.com/pjm/items/667d2eee288e197820b081e4](https://pingcode.yasdb.com/pjm/items/667d2eee288e197820b081e4)    ?    
  #YDBRD-29865 【mysql兼容】支持适配druid 1.2.8

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

场 景：  jdbc:mysql://${host}:${port}//${database}?rewriteBatchedStatements=true&allowMultiQueries=true&useLocalSessionState=true&useUnicode=true&characterEncoding=utf-8&socketTimeout=10000&connectTimeout=60000

rewriteBatchedStatements=true    
  allowMultiQueries=true    
  useLocalSessionState=true    
  useUnicode=true    
       
  连接属性支持：CLIENT_CONNECT_ATTRS    
  1、提前YASHAN-929交付    
  2、新增如下功能    
  @@net_buffer_length AS net_buffer_length, --- 未规划    
  @@query_cache_size AS query_cache_size, --- 未规划    
  @@query_cache_type AS query_cache_type, --- 未规划    
  @@session.autocommit --- 未规划    
  show warnings    
  request ping 命令字：YSMY_CMD_PING

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

### 1、rewriteBatchedStatements=true

  [https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-performance-extensions.html#cj-conn-prop_rewriteBatchedStatements](https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-performance-extensions.html#cj-conn-prop_rewriteBatchedStatements)  

客户端将多组insert、update、delete语句重组成多values的形式：

|  `--优化前`      
    `INSERT INTO users ( id, username, password, email ) VALUES ( 0, `      `'张老0'`      `, `      `'02103'`      `, `      `'02103'`         `)`      
    `INSERT INTO users ( id, username, password, email ) VALUES ( 0, `      `'张老1'`      `, `      `'12113'`      `, `      `'12113'`         `)`      
    `INSERT INTO users ( id, username, password, email ) VALUES ( 0, `      `'张老2'`      `, `      `'22123'`      `, `      `'22123'`         `)`      
    `--优化后`      
    `INSERT INTO users ( id, username, PASSWORD, email ) VALUES ( 0, `      `'张老0'`      `, `      `'02103'`      `, `      `'02103'`         `),( 0, `      `'张老1'`      `, `      `'12113'`      `, `      `'12113'`         `),( 0, `      `'张老2'`      `, `      `'22123'`      `, `      `'22123'`         `)`  |
|:---|


现状：当前insert多组values已支持

### 2、allowMultiQueries=true

  [https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-security.html#cj-conn-prop_allowMultiQueries](https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-security.html#cj-conn-prop_allowMultiQueries)  

可以在sql语句后携带分号，实现多语句执行，支持以下SQL语句：

|  `update xxx set xxx = xxx;update xxx set xxx = xxx;update xxx set xxx = xxx`  |
|:---|


支持COM_QUERY+  COM_STMT_PREPARE进行  多语句执行

现状：需要适配

### 3、useLocalSessionState=true

  [https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-performance-extensions.html#cj-conn-prop_useLocalSessionState](https://dev.mysql.com/doc/connector-j/en/connector-j-connp-props-performance-extensions.html#cj-conn-prop_useLocalSessionState)  

驱动程序是否应参考自动提交和事务隔离，由 'Connection.setAutoCommit（）' 和 'Connection.setTransactionIsolation（）' 和事务状态 由协议维护，而不是查询 数据库或盲目向数据库发送命令 'commit（）' 还是 'rollback（）' 方法调用。

解决问题：  若用户设置参数时不通过JDBC接口(比如setAutoCommit)，而是执行语句'set autocommit=xxx'设置，那么就会存在本地值与远程不一致的情况。如果用户设置  useLocalSessionState=true，则一般表示他不会使用sql语句的方式设置session变量修改事务相关属性，否则后果自行承担。

设置目的：  避免客户端频繁向数据库发送 session 变量查询 SQL。session变量主要为：autocommit，read_only 和 transaction isolation。

主要为客户端表现。

现状：当前协议OK PACKET已支持返回事务状态和隔离级别，其他无需适配。

### 4、useUnicode=true

默认值为true，等价于不设置，调研确认无特殊性。

  


### 5、characterEncoding=utf-8

字符集设置，咱们JDBC字符永远和服务端保持一致，所以不需要设置。

### 6、socketTimeout=10000

超时时间设置，和咱们的参数名和含义都是一致的。

### 7、connectTimeout=60000

获取连接时的超时时间设置，和咱们的参数名和含义都是一致的。

### 8、支持show warnings命令：

|  `show warnings`  |
|:---|


### 9、支持autocommit全局变量：

|  `SELECT @@session.autocommit`  |
|:---|


### 10、request ping

命令字：  YSMY_CMD_PING

### 总结：

以上所有需求已实现

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

##   [6.用例](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

  


## Attachments:

[image2024-7-2_11-45-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOWU4OTcwYzJhZjRmNTIxOWNlIiwicmVmX2lkIjoiNjczOTZlOWU3MjgyMDZlZmI5MmYyYTA4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Mzc1LCJleHAiOjE3ODI1MjQ3NzV9.RzzdGl5LWwFLj55ReOM9kmqmmCxxJHrIo0-kd0wpkEw)

 (image/png)    


[image2024-5-16_15-15-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlOWVhMWFkOWEzMzExZGM5ODQxIiwicmVmX2lkIjoiNjczOTZlOWU3MjgyMDZlZmI5MmYyYTA4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4Mzc1LCJleHAiOjE3ODI1MjQ3NzV9.52VkcM16O7_1N8VAYkJioc5Er0Yvdqa85NpXoSo6XZM)

 (image/png)    
