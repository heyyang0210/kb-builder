Created by 赵育, last modified on 五月 15, 2024

# 1. 概述

协议支持COM_STMT_PREPARE+COM_STMT_EXECUTE + DML+DDL+DCL。

## 2.2 应用场景

- 支持普通DML执行：insert into xxx
- 支持普通DCL执行：set xxx
- 支持普通DDL执行：create xxx


jdbc基础的prepare+execute + directexecte

|类|接口|支持情况|
|---|---|---|
|Statement|boolean   execute(String sql)|√|
|PreparedStatement|boolean   execute()|√|
|PreparedStatement|int   executeUpdate  ()|√|


## 2.3 规格约束

目前支持

1、非绑定参数

2、非批量执行

3、非DQL

# 3. 详细测试设计

## 3.1 测试设计方法

从功能出发，结合等价类、边界值的测试设计方法，输出测试设计。

## 3.2 详细测试设计

主要分为 2 个大的测试场景，通过 JDBC 驱动相关接口来完成测试。

- prepare+execute
- direct execte


功能测试

- 分别使用   prepare+execute/  direct execte   来创建表、SET AUTOCOMMIT false/true、  插入记录、update 记录、delete 记录，删除表操作；


协议涉及字段的功能测试

|命令字|功能|报文类型|协议字段|长度|说明|测试场景|
|---|---|---|---|---|---|---|
|YSMY_CMD_STMT_PREPARE|预处理|req|sql|剩余报文长度|  
|覆盖 sql 文本长度覆盖：  2MB - 1|
|  
|  
|ack|status|1|MY_OK_HEADER|  
|
|  
|  
|  
|stmtId|4|  
|  
|
|  
|  
|  
|num_columns|2|未实现|  
|
|  
|  
|  
|num_params|2|未实现|  
|
|  
|  
|  
|reserved_1|1|  
|  
|
|  
|  
|  
|warning_count|2|未实现|  
|
|YSMY_CMD_STMT_EXECUTE|执行|req|stmtId|4|  
|  
|
|  
|  
|  
|flags|1|  [https://dev.mysql.com/doc/dev/mysql-server/latest/mysql__com_8h.html#a3e5e9e744ff6f7b989a604fd669977da](https://dev.mysql.com/doc/dev/mysql-server/latest/mysql__com_8h.html#a3e5e9e744ff6f7b989a604fd669977da)  ,CURSOR_TYPE_NO_CURSOR= 0,    
  CURSOR_TYPE_READ_ONLY= 1,    
  CURSOR_TYPE_FOR_UPDATE= 2,    
  CURSOR_TYPE_SCROLLABLE= 4,默认处理CURSOR_TYPE_NO_CURSOR的场景，遇到二进制结果集全部发完，后续协议上无fetch流程|基本场景中覆盖，无其他测试点|
|  
|  
|  
|iteration_count|4|Currently always 1|  
|
|  
|  
|ack|status|1|MY_OK_HEADER|  
|
|  
|  
|  
|affectedRows|变长|  
|获取接口返回值，检查插入、更新、删除行数是否正确返回|
|  
|  
|  
|lastInsertId|变长|依赖SQL层  AUTO_INCREMENT列属性，未实现|暂时无法测试|
|  
|  
|  
|serverStatus|2|  [https://conf.yasdb.com/x/vwuXC](https://conf.yasdb.com/x/vwuXC)  |SERVER_STATUS_IN_TRANS ,通过事务基本功能来测试  ---功能未适配,SERVER_STATUS_AUTOCOMMIT ,setAutoCommit(boolean autoCommit)--功能不支持，只有语法适配|
|  
|  
|  
|warnings|2|未实现|  
|
|YSMY_CMD_STMT_CLOSE|关闭stmt|req|stmtId|4|  
|1、pstmt 未关闭时，被重新赋值，通过关闭连接来关闭残留的 pstmt；con.close(）,2、pstmt 关闭时，通过 yashandb 端观察 stmt 在服务端正常关闭|
|  
|  
|ack|无|  
|  
|  
|


  


*2、梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|---|---|
|CT|不涉及|
|KT|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


  


详见附件

# 5. 测试框架设计

- testng 测试框架，补充 mysql jdbc 驱动测试用例


# 6. 测试环境说明

*不涉及*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTk4OTcwYzJhZjRmNTIxODY2IiwicmVmX2lkIjoiNjczOTZlNTk1OTNmOTljOWZmMjM4M2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTEyLCJleHAiOjE3ODI0NTc5MTJ9.kbBzS3KCmGGdHr5g-63Q3enE5n8Ydf_jXfQ57kucAbE)

## Attachments:

[COM_QUERY文本结果集支持基础类型测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTlhMWFkOWEzMzExZGM5NmRhIiwicmVmX2lkIjoiNjczOTZlNTk1OTNmOTljOWZmMjM4M2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTEyLCJleHAiOjE3ODI0NTc5MTJ9.e5drjBZYDuBqELnphOr3sH4NBdDRj4XJrG_udzEzmlE)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[image2024-4-23_11-26-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTlhMWFkOWEzMzExZGM5NmRiIiwicmVmX2lkIjoiNjczOTZlNTk1OTNmOTljOWZmMjM4M2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTEyLCJleHAiOjE3ODI0NTc5MTJ9.VXY_X7wauoY8_TmSvkCbbw5g4R4EKmUrrF48D8kupOk)

 (image/png)    


[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTk4OTcwYzJhZjRmNTIxODY2IiwicmVmX2lkIjoiNjczOTZlNTk1OTNmOTljOWZmMjM4M2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTEyLCJleHAiOjE3ODI0NTc5MTJ9.kbBzS3KCmGGdHr5g-63Q3enE5n8Ydf_jXfQ57kucAbE)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTk4OTcwYzJhZjRmNTIxODY3IiwicmVmX2lkIjoiNjczOTZlNTk1OTNmOTljOWZmMjM4M2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNTEyLCJleHAiOjE3ODI0NTc5MTJ9.Wo3qd2aG4hYxf-Hyj-I-Cv9mxUeGzZKvjf6lyBTIlbo)

 (application/msword)    
