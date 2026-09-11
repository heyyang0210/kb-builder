Created by 刘丹, last modified on 二月 01, 2024

**IR链接：**    [YDBRD-13902](https://jira.yasdb.com/browse/YDBRD-13902?src=confmacro)    -  支持session级别的commit nowait参数  完成  **SR链接：**    [YDBRD-15260](https://jira.yasdb.com/browse/YDBRD-15260?src=confmacro)    -  支持session级别的commit nowait参数  完成

# **1.概述**

支持为 commit 语句增加 session 级别的 NOWAIT 参数

  


# **2.需求分析**

- 支持使用 SQL 语句 
- **修改 session 级参数 SES_COMMIT_WAIT 为 WAIT 或 NOWAIT**


|  `alter session set ses_commit_wait = nowait;`  |
|:---|


- 已存在系统级参数 COMMIT_WAIT，新增会话级参数为 SES_COMMIT_WAIT
- 当前参数值仅可为 WAIT、NOWAIT，其余均报错
- 每次仅修改当前会话的该参数值，重新连接后失效
- 观测点


  `show parameter commit;`     查询的是 "commit" 参数的值，它表示事务提交方式的设置。

  `show parameter isolation_level;`     查询的是 "isolation_level" 参数的值，它表示数据库的隔离级别设置。

     常见的取值有：

-   `read_committed`    ：表示读已提交隔离级别。
-   `serializable`    ：表示可串行化隔离级别。
- 系统级别:alter system set commit_wait=nowait scope=spfile;


# **3.测试设计方法**

### 3.1 特性关联领域分析：

1.部署形态：单机部署和一主两备主备部署

2.使用会话级别的修改语句

3.将会话级别的参数和系统级别的参数进行组合验证，确认优先级

### **3.2**  ** **  梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|
|资料|是|


### 3.3测试设计：

语法验证部分采用等价类划分，功能部分采用场景法

  


# **4.详细测试设计**

测试范围：

-  表结构：heap、tac、lsc
- master 表类型：分区表、普通表、临时表
- 部署形态：单机、HA


测试关注点：

- 语法错误可以正常报错
- 不会发生死锁情况
- 设置的参数和查询的参数一致
- 会话级别观测点是show parameter commit_wait;
- 系统级别观测点是show parameter commit;
- 隔离级别查询点：show parameter isolation_level;
- 优先级别commit write wait>session级别的>系统级别


参数组合验证：

|系统级别参数|会话参数|commit直接|  
|
|---|---|---|---|
|wait|wait|nowait|  
|
|wait|nowait|wait|  
|
|wait|nowait|nowait|  
|
|wait|wait|wait|  
|
|nowait|wait|wait|  
|
|nowait|nowait|wait|  
|
|nowait|wait|nowait|  
|
|nowait|nowait|nowait|  
|


场景验证：

|序号|场景|  
|  
|
|---|---|---|---|
|1|将会话级别修改为nowait,做dml操作|  
|  
|
|2|将会话级别修改为nowait,闪回和回滚操作|  
|  
|
|3|系统级别是wait,修改session级别是nowait,打开另一个session,查询是nowait|  
|  
|
|4|系统级别是nowait,修改session级别是wait,打开另一个session,查询是wait|  
|  
|
|5|会话级别修改为nowait,修改系统级别参数，查询会话级别|  
|  
|


[支持session级别的commit nowait参数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjM4OTcwYzJhZjRmNTFmYjRkIiwicmVmX2lkIjoiNjczOTY5ZjM1OTNmOTljOWZmMjM1NDY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjkzLCJleHAiOjE3ODIyOTY2OTN9.5DtKf-upS3dNh0gMAPfX2uaVlVpQP7McyBFb9_KkMFA)

# **5.测试用例**

使用guider框架执行，

# **6.测试框架设计**

采用guider框架，编写sql脚本

# **7.测试环境说明**

|服务器|  
|
|---|---|
|操作系统|linux|
|部署|单机|


## Attachments:

[支持session级别的commit nowait参数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjM4OTcwYzJhZjRmNTFmYjRkIiwicmVmX2lkIjoiNjczOTY5ZjM1OTNmOTljOWZmMjM1NDY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjkzLCJleHAiOjE3ODIyOTY2OTN9.5DtKf-upS3dNh0gMAPfX2uaVlVpQP7McyBFb9_KkMFA)

 (application/x-xmind)    


[session级别的nowait参数文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjNhMWFkOWEzMzExZGM3OWMzIiwicmVmX2lkIjoiNjczOTY5ZjM1OTNmOTljOWZmMjM1NDY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMjkzLCJleHAiOjE3ODIyOTY2OTN9.UsVWw9QBtqp4ELUQb2GDxI6kgD-9tBDURnwvzwDmhAA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
