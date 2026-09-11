Created by 冯皓博, last modified on 五月 13, 2024

  [https://pingcode.yasdb.com/pjm/items/6618fdf7fd997db58ad86c34](https://pingcode.yasdb.com/pjm/items/6618fdf7fd997db58ad86c34)    ?    
  #YDBRD-26231 【mysql兼容】（协议）MYSQL驱动相关协议适配-支持普通DML+DDL+DCL执行

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

协议支持COM_STMT_PREPARE+COM_STMT_EXECUTE + DML+DDL+DCL

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

外场mysql

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

无

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

支持普通DML执行：insert into xxx    
  支持普通DCL执行：set xxx    
  支持普通DDL执行：create xxx

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#2-%E6%8E%A5%E5%8F%A3)  

jdbc基础的prepare+execute + directexecte

|类|接口|支持情况|
|---|---|---|
|Statement|boolean   execute(String sql)|√|
|PreparedStatement|boolean   execute()|√|
|PreparedStatement|int   executeUpdate  ()|√|
|  
|  
|  
|


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

目前支持

1、非绑定参数

2、非批量执行

3、非DQL

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

支持以下命令字

|命令字|功能|
|---|---|
|YSMY_CMD_STMT_PREPARE|预处理|
|YSMY_CMD_STMT_EXECUTE|执行|
|YSMY_CMD_STMT_CLOSE|关闭stmt|


###   [4.1 YSMY_CMD_STMT_PREPARE](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

req：

|报文|长度|说明|实现情况|
|---|---|---|---|
|sql|剩余报文长度|  
|√|


ack：

|报文|长度|说明|实现情况|
|---|---|---|---|
|status|1|MY_OK_HEADER|√|
|stmtId|4|  
|√|
|num_columns|2|  
|×|
|num_params|2|  
|×|
|reserved_1|1|  
|√|
|warning_count|2|  
|×|


###   [4.2 YSMY_CMD_STMT_EXECUTE](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

req：

|报文|长度|说明|实现情况|
|---|---|---|---|
|stmtId|4|  
|√|
|flags|1|  [https://dev.mysql.com/doc/dev/mysql-server/latest/mysql__com_8h.html#a3e5e9e744ff6f7b989a604fd669977da](https://dev.mysql.com/doc/dev/mysql-server/latest/mysql__com_8h.html#a3e5e9e744ff6f7b989a604fd669977da)  ,CURSOR_TYPE_NO_CURSOR= 0,    
  CURSOR_TYPE_READ_ONLY= 1,    
  CURSOR_TYPE_FOR_UPDATE= 2,    
  CURSOR_TYPE_SCROLLABLE= 4|默认处理CURSOR_TYPE_NO_CURSOR的场景，遇到二进制结果集全部发完，后续协议上无fetch流程|
|iteration_count|4|Currently always 1|√|


ack：

OK Packet

###   [4.3 YSMY_CMD_STMT_CLOSE](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

req：

|报文|长度|说明|实现情况|
|---|---|---|---|
|stmtId|4|  
|√|


ack：

无

###   [4.4 OK Packet](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

|报文|长度|说明|实现情况|
|---|---|---|---|
|status|1|MY_OK_HEADER|√|
|affectedRows|变长|  
|√|
|lastInsertId|变长|依赖SQL层  AUTO_INCREMENT列属性|×|
|serverStatus|2|  [https://conf.yasdb.com/x/vwuXC](https://conf.yasdb.com/x/vwuXC)  |部分支持|
|warnings|2|  
|×|


###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

1、stmt声明周期：YSMY_CMD_STMT_PREPARE+YSMY_CMD_STMT_CLOSE

通过动态视图测试下已打开的stmt是否关闭

2、OK packet中的  serverStatus目前仅支持  SERVER_STATUS_IN_TRANS +SERVER_STATUS_AUTOCOMMIT

其他状态暂不支持

###   [4.6 待补充依赖项](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

1、set、get、show命令

2、  serverStatus状态

3、lastInsertId状态

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

##   [6.测试配置](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

```
String url = "jdbc:mysql://192.168.146.128:1700/mysql?useLocalSessionState=true";
String userID = "sys";//MySQL的用户名
String pass = "Cod-2022";//MySQL的密码
Connection conn = DriverManager.getConnection(url,userID,pass);//连接数据库
```

  


  


  
