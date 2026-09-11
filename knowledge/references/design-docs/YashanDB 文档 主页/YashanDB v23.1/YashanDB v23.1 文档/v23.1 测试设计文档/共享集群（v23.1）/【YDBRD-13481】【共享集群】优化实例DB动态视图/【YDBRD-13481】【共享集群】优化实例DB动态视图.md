Created by 张丽红, last modified by  马爽 on 二月 22, 2024

**SR链接：**    [YDBRD-13478](https://jira.yasdb.com/browse/YDBRD-13478?src=confmacro)    **-**  **【共享集群】支持创建集群数据库**  **完成**

**开发设计文档链接：**    [集群数据库基本设计](107389797.html)  

# **1.概述**

这个需求和    [【YDBRD-13478】【共享集群】支持创建集群数据库](https://jira.yasdb.com/browse/YDBRD-13478)     这个需求关联，在"支持创建集群数据库"这个需求实现时，识别到需要对单机已有动态视图  **"v$instancce"**  进行适配和修改

# **2.需求分析**

详细变化在"动态视图"部分描述

# **3.规格/范围**

1、部署形态：集群

2、测试环境：模拟器环境

# **4.约束限制**

1. 目前只支持4节点集群
1. 故障场景当前不考虑


# **5.动态视图/配置参数**

### 5.1.动态视图

**v$instance视图涉及到修改：新增3个字段：INSTANCE_NUMBER，INSTANCE_NAME，PARALLEL**

**说明：**

**（1）本视图显示当前实例状态的汇总信息**

**（2）创建集群数据库需要设置配置参数CLUSTER_DATABASE=TRUE**

|视图字段|字段名称|字段类型|说明|备注|
|---|---|---|---|---|
|  
|STATUS|VARCHAR(16)|实例状态,* CLOSED: 数据库进程正在启动,* STARTED：数据库进程启动，此状态下不能操作数据库,* MOUNTED：数据库进程已经加载物理文件，此状态下能进行少量的维护操作,* OPEN：数据库正常运行状态,* OPEN UPGRADE：数据库进入升级模式 |原有字段|
|  
|VERSION|VARCHAR(64)|数据库版本号|原有字段|
|  
|STARTUP_TIME|TIMESTAMP|数据库实例启动时间|原有字段|
|  
|HOST_NAME|VARCHAR(256)|主机用户名|原有字段|
|  
|DATA_HOME|VARCHAR(256)|数据库DATA路径|原有字段|
|  
|  
|  
|  
|  
|
|  
|INSTANCE_NUMBER|INTEGER|实例编号，和实例id一一对应|新增字段|
|  
|INSTANCE_NAME|VARCHAR(64)|实例名称|新增字段|
|  
|PARALLEL|VARCHAR(8)|实例是否以集群数据库模式挂载(YES)或(NO)|新增字段|


# **6.测试设计方法**

### 6.1.动态视图测试

这部分测试主要采用动态视图的一些公共测试方法进行测试，主要从以下几个方面来测试：

1、针对视图的每一个字段构造对应的业务场景，校验字段值的正确性；尤其是新增字段

2、检查视图对基本的ddl和dml写操作是否有做拦截

3、考虑在业务下发的过程中动态查询视图

详细测试点参考"详细测试设计"

### 6.2.约束限制测试

无

# **7.详细测试设计**

[YDBRD-13481-优化DB动态视图_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmE4OTcwYzJhZjRmNTFmYTM0IiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTY2LCJleHAiOjE3ODIyOTQ5NjZ9.4L__0M97AziX0N-M-_Qj6nEqzuhwKnsBrWOISgZ7LEo)

# **8.测试用例**

# **9.测试框架/测试用例自动化**

  


# **10.测试环境说明**

  


# **11.测试版本**

  


## Attachments:

[YDBRD-13481-优化DB动态视图_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmFhMWFkOWEzMzExZGM3OGFjIiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTY2LCJleHAiOjE3ODIyOTQ5NjZ9.vy0UnsiV-dmece_Sm5LOYtto_r1t424yT6aXx8LiN1U)

 (application/x-xmind)    


[YDBRD-13481-优化DB动态视图_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmE4OTcwYzJhZjRmNTFmYTM0IiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTY2LCJleHAiOjE3ODIyOTQ5NjZ9.4L__0M97AziX0N-M-_Qj6nEqzuhwKnsBrWOISgZ7LEo)

 (application/x-xmind)    


[image2024-2-22_17-33-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmE4OTcwYzJhZjRmNTFmYTM2IiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTY2LCJleHAiOjE3ODIyOTQ5NjZ9.Bi_ikj8-SL-EmZwxEdfQeiJXQJOkKl3hCFKvgeWp0Is)

 (image/png)    


[YDBRD-13481优化实例DB动态视图文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YmE4OTcwYzJhZjRmNTFmYTM4IiwicmVmX2lkIjoiNjczOTY5YmE3MjgyMDZlZmI5MmVmNmFjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTY2LCJleHAiOjE3ODIyOTQ5NjZ9.87DGq6OPNwo0DCmK3MWr-ThBcqLVU1n2y_cCB6T-XCI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
