

## **需求概述：**

**支持**  GV$SESSION视图新增字段WAIT_CLASS，包含DV$SESSION和V$SESSION视图

# 2.   **需求分析**

SR链接：

  [https://pingcode.yasdb.com/pjm/items/67051fa4e489dd0868f22064](https://pingcode.yasdb.com/pjm/items/67051fa4e489dd0868f22064)  ?  
#YDBRD-33502 GV$SESSION视图新增字段WAIT_CLASS

测试设计调研文档链接：

  [YDBRD-33505 支持GV$EVENT_HISTOGRAM视图 YDBRD-33502 GV$SESSION视图新增字段WAIT_CLASS 测试调研 - 刘大境 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/resumedraft.action?draftId=177835179&draftShareId=a257eec3-d75d-4e00-a284-11414983a897&)  

开发设计文档链接：  [https://pingcode.yasdb.com/wiki/pages/6743dea8593f99c9ff289f03](https://pingcode.yasdb.com/wiki/pages/6743dea8593f99c9ff289f03)  

  


**需求来源：**     **新数科技监控系统适配**

**需求场景：**  /*NDTM*/SELECT A.INST_ID, TOTAL_COUNT, NVL(ACTIVE_COUNT, 0) AS ACTIVE_COUNT FROM (SELECT INST_ID, COUNT(1) AS TOTAL_COUNT FROM GV$SESSION T WHERE TYPE <> 'BACKGROUND' GROUP BY INST_ID) A LEFT JOIN (SELECT INST_ID, COUNT(1) AS ACTIVE_COUNT FROM GV$SESSION WHERE STATUS = 'ACTIVE' AND TYPE <> 'BACKGROUND' AND UPPER(WAIT_CLASS) <> 'IDLE' GROUP BY INST_ID) B ON A.INST_ID = B.INST_ID

SELECT A.INST_ID,   
TOTAL_COUNT, 
NVL(ACTIVE_COUNT, 0) AS ACTIVE_COUNT 
FROM (SELECT INST_ID, COUNT(1) AS TOTAL_COUNT 
FROM GV$SESSION T 
WHERE TYPE <> 'BACKGROUND' 
GROUP BY INST_ID) A 
LEFT JOIN (SELECT INST_ID, COUNT(1) AS ACTIVE_COUNT 
FROM GV$SESSION 
WHERE STATUS = 'ACTIVE' 
AND TYPE <> 'BACKGROUND' 
AND UPPER(WAIT_CLASS) <> 'IDLE' 
GROUP BY INST_ID) B 
ON A.INST_ID = B.INST_ID;

**需求范围：**  单机、集群、分布式

**需求规格**  ：/

**应用场景**  ：GV$SESSION视图WAIT_CLASS 等待字段进行性能瓶颈监控以及SQL查询优化 故障排查、等待事件等

**功能概述：**

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|动态视图|v$session、dv$session、gv$session 新增字段：WAIT_CLASS|WAIT_CLASS：用于指示当前会话等待的类别,![image.png](https://pingcode.yasdb.com/atlas/files/public/6745b2378970c2af4f53b8af/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTkyMjEsImV4cCI6MTc4MjQ3MDAyMX0.awLkx0pweOIULkpVfR47WFNaTSAVziea9y7p8vVB7D8)|是|


# **3. 测试设计方法**

**(1). 视图字段的正确性，使用场景法和错误推测法设计**

**(2). 覆盖单机、集群、分布式三种部署形态**

**(3). 覆盖升级场景：23.2的归档版本到最新转测版本**

**(4). DFX覆盖**

  


### 3.1 DFX覆盖：

|系统级DFX分类|是否涉及|备注|
|:---|:---|:---|
|CT|Y|  
|
|KT|Y|  
|
|长稳|Y|  
|
|一致性|N|  
|
|三方测试工具    
  (sqltest，sqlancer)|N|  
|
|安全|N|  
|
|DFR|N|  
|
|HA|Y|  
|
|压力|N|  
|
|性能|N|  
|
|可维护性|N|  
|
|升级|Y|  
|
|资料|Y|  
|


# **4. 详细测试设计**

**测试观测点：**

**字段名称正常**

**构造不同场景，观测字段的值是否正确**

|视图需求|部署形态|测试场景|预期|备注|
|---|---|---|---|---|
|V$seesion,dv$seesion,gv$seesion|单机、集群、分布式|使用不同方法查询,V$seesion,dv$seesion,gv$seesion,视图WAIT_CLASS字段：desc|查询字段定义准确 无错别字|  
|
|  
|  
|KILL重启后seesion状态查询,V$seesion,dv$seesion,gv$seesion,视图 wait_class字段|返回Idle：表示会话处于空闲状态，没有活动|  
|
|  
|  
|HA场景构造网络延迟场景状态查询,V$seesion,dv$seesion,gv$seesion|返回Network：表示会话在等待网络操作完成|  
|
|  
|  
|复用历史表锁用例standalone/testcase/storage/transaction_01/lock/heap|返回Concurrency：表示会话在等待其他会话释放资源，可能是锁或其他同步机制|  
|
|  
|  
|会话1 ：临时表带临时表空间+索引+大批量插入操作时+索引列查询 ,会话2： SELECT wait_class FROM v_$session where wait_class='System I/O';|返回  System I/O ：   表示会话在等待系统级别的输入/输出操作。|  
|
|  
|  
|会话1：普通表+索引+大批量插入操作时,会话2： SELECT wait_class FROM v_$session where wait_class='User I/O';|返回  USER I/O ：   表示会话在等待系统级别的输入/输出操作。|  
|
|  
|CT/KT    长稳| 复用历史用例+ 查询,V$seesion,dv$seesion,gv$seesion,视图 wait_class字段|无core|  
|
|升级|单机|从br23.2归档包升级到最新转测版本，升级前,做统计信息收集业务|升级后查询,GV$EVENT_HISTOGRAM,V$EVENT_HISTOGRAM,DV$EVENT_HISTOGRAM  视图字段|  
|


# **5.测试用例**

# **6.测试框架设计**

**功能用例添加到YTP平台上**

**DFX用例分别添加到yasft_dfx以及yasft仓上**

# **8.测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|LIUNX|
|部署|单机、分布式、集群|


# **9.测试工作量评估**

1人/7天

  
