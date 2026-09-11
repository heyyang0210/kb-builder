Created by 张丽红, last modified by  李佐龙 on 十二月 15, 2023

**SR链接：**    [YDBRD-13477](https://jira.yasdb.com/browse/YDBRD-13477?src=confmacro)    **-**  **【共享集群】GCS动态视图与系统统计**  **完成**

**开发设计文档链接：**

  [动态视图设计](/pages/createpage.action?spaceKey=YAS&title=%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE%E8%AE%BE%E8%AE%A1)  

  [GCS动态视图设计](113970847.html)  

# **1.概述**

该需求主要针对技术项目已有视图做一些优化和新增

# **2.需求分析**

涉及视图：

|视图名称|视图含义|备注|
|---|---|---|
|V$GRC_RESOURCE|该视图显示共享集群全局master资源情况 。|  
|
|V$RESOURCE_REQUEST|该视图显示共享集群资源当前等待处理的消息 。|  
|
|V$GRC_DHTRULE|该视图显示共享集群中master资源的hash分布情况 。|  
|
|V$GRC_PASTCOPY|该视图显示共享集群PAST COPY BLOCK（多实例同时持有脏块时，只有最新版本的一个实例具备写权限，其他不具备写权限的历史版本实例所持有的脏块称为PAST COPY BLOCK）信息。|  
|
|V$BUFFER_CONTROL|该视图显示数据缓存区页面控制信息。|  
|


# **3.规格**

1、部署模式：集群

2、节点个数：4节点上限（测试时使用3节点）

3、部署环境：单主机磁阵

# **4.约束限制**

无

# **5.动态视图/配置参数**

  


# **6.测试设计方法**

针对该需求的测试主要从视图的公共测试角度进行，主要采用场景法进行，涉及的主要测试维度如下：

1、针对视图本身的名称和字段名称，字段类型定义的规范性做校验，这部分涉及资料，新增视图在资料中要有新增

2、针对视图的DDL和DML写操作是否做拦截，做校验

3、针对视图的权限做校验，所有用户都有权限查看动态视图，非sys用户可创建不同schedule下的同名动态视图

4、针对视图的基本过滤查询做校验

5、针对视图中涉及到的每个字段的值的正确性做校验

6、从业务的角度考虑视图和业务的并发，以及该视图和其它视图之间的关联

7、观察该视图在单机上的表现

# **7.详细测试设计**

[【YDBRD-13477】【共享集群】GCS动态视图与系统统计_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjhhMWFkOWEzMzExZGM3OGEyIiwicmVmX2lkIjoiNjczOTY5Yjg1OTNmOTljOWZmMjM1MjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTExLCJleHAiOjE3ODIyOTQ5MTF9.zd1suro68vzYoBIBkOOURlXxG7pRXr3XG7aLgf73LEg)

# **8.测试用例**

[【YDBRD-13477】【共享集群】GCS动态视图与系统统计_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Yjk4OTcwYzJhZjRmNTFmYTJiIiwicmVmX2lkIjoiNjczOTY5Yjg1OTNmOTljOWZmMjM1MjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTExLCJleHAiOjE3ODIyOTQ5MTF9.R8NtZljAqXmByrsDvtITK2itprSPvnSJpl_a6eqp4Us)

# **9.测试框架/测试用例自动化**

  


# **10.测试环境说明**

  


# **11.测试版本**

  


## Attachments:

[【YDBRD-13477】【共享集群】GCS动态视图与系统统计_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Yjk4OTcwYzJhZjRmNTFmYTJjIiwicmVmX2lkIjoiNjczOTY5Yjg1OTNmOTljOWZmMjM1MjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTExLCJleHAiOjE3ODIyOTQ5MTF9.EV2VKQxQsHhytJB_eROSK89-8rXqxqhcbFLNVau8990)

 (application/x-xmind)    


[【YDBRD-13477】【共享集群】GCS动态视图与系统统计_测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YjhhMWFkOWEzMzExZGM3OGEyIiwicmVmX2lkIjoiNjczOTY5Yjg1OTNmOTljOWZmMjM1MjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTExLCJleHAiOjE3ODIyOTQ5MTF9.zd1suro68vzYoBIBkOOURlXxG7pRXr3XG7aLgf73LEg)

 (application/x-xmind)    


[【YDBRD-13477】【共享集群】GCS动态视图与系统统计_测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Yjk4OTcwYzJhZjRmNTFmYTJiIiwicmVmX2lkIjoiNjczOTY5Yjg1OTNmOTljOWZmMjM1MjE1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4NTExLCJleHAiOjE3ODIyOTQ5MTF9.R8NtZljAqXmByrsDvtITK2itprSPvnSJpl_a6eqp4Us)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,1、"V$GRC_RESOURCE "视图中"IN_PROCESS"字段和"REQUEST_COUNT"字段指的是并发场景下，并不是当前已经请求过的全部？,-----答：是的,2、"V$RESSOURCE_REQUEST"视图中如何构造让各种消息处于等待状态？,-----答：还是尝试通过并发场景去构造，但是并不能精准的构造,3、“V$GRC_DHTRULE”视图中的"VERSION"字段如果一直重复变化，有没有可能和初始值相同，变化规则是什么样子？是迭代增加吗？,-----答：不会和初始值相同，值是一直++的,4、“V$GRC_PASTCOPY”视图中应该不会有lock资源的存在的吧？,-----答：不会有，只会有block资源的存在,5、“V$GRC_PASTCOPY”视图中"LSN"字段的正确性如何验证？,-----答：该字段的值对于测试而言没有验证意义,6、"V$BUFFER_CONTROL"视图中提供可测字段？,-----答：待忠友提供,7、这部分视图在单机上的表现？,V$GRC_RESOURCE     
  V$RESSOURCE_REQUEST     
  V$GRC_DHTRULE     
  V$GRC_PASTCOPY     
  V$BUFFER_CONTROL,-----在单机上这些视图的字段值应该为空    
    
,  
,  
,  
,Posted by zhanglihong at 六月 17, 2023 15:54|
|---|
|  [](null)  ,1、在支持DB启停和业务的并发之后需要补充如下场景：,（1）V$GRC_DHTRULE视图查询和DB启停操作的并发,（2）V$GRC_DHTRULE视图查询，dml/ddl业务，DB启停操作的并发,（3）V$GRC_RESOURCE视图查询，DB启停，dml/ddl业务操作的并发,Posted by zhanglihong at 六月 21, 2023 16:53|
