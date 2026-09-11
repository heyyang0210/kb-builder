## **需求概述：**

**支持GV$EVENT_HISTOGRAM视图，包含V$EVENT_HISTOGRAM和DV$EVENT_HISTOGRAM视图**

# 2.   **需求分析**

SR链接：

  [https://pingcode.yasdb.com/pjm/items/67052053e489dd0868f22086](https://pingcode.yasdb.com/pjm/items/67052053e489dd0868f22086)    ?    
  #YDBRD-33505 支持GV$EVENT_HISTOGRAM视图

测试设计调研文档链接：

  [YDBRD-33505 支持GV$EVENT_HISTOGRAM视图 YDBRD-33502 GV$SESSION视图新增字段WAIT_CLASS 测试调研 - 刘大境 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/resumedraft.action?draftId=177835179&draftShareId=a257eec3-d75d-4e00-a284-11414983a897&)  

开发设计文档链接：  [https://pingcode.yasdb.com/wiki/pages/6749691ed2baff0fd558b730](https://pingcode.yasdb.com/wiki/pages/6749691ed2baff0fd558b730)  

  


**需求来源：**     **新数科技监控系统适配**

**需求场景：**  显示每个事件的等待次数、最大等待时间和总等待时间（以毫秒为单位）的直方图。 直方图具有 < 1 ms、< 2 ms、< 4 ms、< 8 ms、... < 221 ms、< 222 ms 和 >= 222 ms 的时间间隔桶。

**需求范围：**  单机、集群、分布式

**需**  **求规格**  ：/

**应用场景**  ：GV$EVENT_HISTOGRAM视图，进行性能瓶颈监控以及SQL查询优化 故障排查、等待事件等

**功能概述：**

|接口|接口表现|接口说明|是否涉及|Oracle比对|
|---|---|---|---|---|
|动态视图|v$event_histogram、dv$event_histogram、gv$event_histogram、,新增字段：   , EVENT   ,WAIT_TIME_MILLI   ,WAIT_COUNT  ,LAST_UPDATE_TIME  |**视图是等待事件直方图。有点类似于列上应用的直方图，用于描述等待事件在特定等待间时段内的频度，根据对某些特定等待事件的频度停止分析可以得出该等待事件是不是处于异常状态，进而取采进一步的办法**,  
EVENT                             VARCHAR2(64)           —— 表示数据库中具体的事件名称。每个事件都与数据库的性能或状态相关，通常与等待事件、资源竞争或特定操作有关
WAIT_TIME_MILLI           NUMBER                     —— 单位毫秒，在这个bucket区间( <num ) 的直方图
WAIT_COUNT                 NUMBER                     —— 在这个bucket区间等待的次数
LAST_UPDATE_TIME       VARCHAR2(73)            —— bucket的最后一次更新时间 ( 最后一次等待落入bucket区间的结束时间戳 )|是|,![image.png](https://pingcode.yasdb.com/atlas/files/public/675017b3a1ad9a3311de4013/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTg3NzcsImV4cCI6MTc4MjQ2OTU3N30.5ZMhuemKrpwgs0vxttrYSyuczguFb2tSv0Oa2YDhOqI)|


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
|长稳|N|  
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
|升级|N|  
|
|资料|Y|  
|


# **4. 详细测试设计**

**测试观测点：**

**字段名称正常**

**构造不同场景，观测字段的值是否正确**

|视图需求|部署形态|测试场景|预期|备注|
|---|---|---|---|---|
|V$EVENT_HISTOGRAM,DV$EVENT_HISTOGRAM,GV$EVENT_HISTOGRAM|单机|使用不同方法查询视图：desc，  （select 不带filter、带filter、group by、join、子查询、having、distinct、order by、limit)|查询成功，字段定义正确，字段不缺失，无错别字|  
|
|  
|  
|在单机形态下，查,DV$EVENT_HISTOGRAM ,GV$EVENT_HISTOGRAM|查询成功，字段定义正确，字段不缺失|  
|
|  
|  
|视图权限交互创建普通用户查询视图|未赋权查询视图失败，赋权后查询成功|  
|
|||表锁场景：无数据修改的时候的多个连续的savepoint加表锁，收集直方图统计信息|视图观测对应桶次数是否增加  count是否为0,行锁前后 查询,死锁时间控制不同秒/分钟 查询 ,commit前后查询||
|||行锁场景：创建2个会话，会话1创建表插入数据提交update、收集直方图统计信息|视图观测对应桶次数是否增加  count是否为0,行锁前后 查询,死锁时间控制不同秒/分钟 查询 ,commit前后查询||
|||xlsot锁场景：3个会话下分别创建3个不同表并插入数据、收集直方图统计信息,会话1 2 3  update 表1 表2  表3,会话1 2 3  update 表2 表3  表1 ,|视图观测对应桶次数是否增加  count是否为0,xlsot锁前后 查询,死锁时间控制不同秒/分钟 查询 ,commit前后查询||
|  
|HA|主备环境下，备机查询视图，备升主后，旧主查询视图,  
|备机查询不到，升主后新主查询不到wait_event|  
|
|  
|  
|数据库在不同状态下查询视图|仅open可查，其他状态查询报错|  
|
|  
|CT/KT|构造行锁场景+V$EVENT_HISTOGRAM视图查询|无core 卡住现象|  
|
|  
|集群|覆盖以上场景( 测试GV$EVENT_HISTOGRAM、V$EVENT_HISTOGRAM)|GV$EVENT_HISTOGRAM 在不同实例上汇总信息,V$EVENT_HISTOGRAM 在当前实例上汇总信息|  
|
|  
|分布式|覆盖以上场景( 测试DV$EVENT_HISTOGRAM、V$EVENT_HISTOGRAM、GV$EVENT_HISTOGRAM)|GV$EVENT_HISTOGRAM显示所有实例的汇总信息,V$EVENT_HISTOGRAM只显示当前实例的汇总信息,DV$EVENT_HISTOGRAM保持现状|  
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

  
