Created by 张地强 on 六月 12, 2023

# 1.   **概述**

通过查询SQL，OM根据算法推导出AC列表供用户选择。采用yasboot命令，  可以使用  预定义的SQL集合或者使用    `v$sqlarea`    中的SQL语句  作为输入，然后输出AC列表。

SR：    [YDBRD-14267](https://jira.yasdb.com/browse/YDBRD-14267?src=confmacro)    -  【OM】OM支持AC推荐算法能力  完成

# 2.   **需求分析**

### **2.1 功能分析**

1. 获取用户输入的SQL或从Cache中获取SQL
1. 解析SQL并输出查询中特定表的相关投影列和谓词列
1. 输出可覆盖原始语句的多个AC DDL语句
1. 输出各AC的统计代价
1. 输出基于代价排序的AC列表


       参考：    [AC自动发现方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=107389599)  

### 2.2 规格约束

#### 2.2.1 规格

1. 谓词列作为X，投影列作为Y；
1. 没有谓词列使用    `on only`    只添加Y列；
1. 新建AC的XY列不能和已有AC的XY列重复；
1. 投影列和谓词列有列重复时，去重，投影列优先；
1. 自动生成不存在且不重复的AC名称。


#### 2.2.2 约束

1. 暂不支持推荐跨表AC
1. 历史SQL仅限于PlanCache(v$sqlarea)中保存的
1.   `v$sqlarea`    暂不支持    `sql_fulltext`    ，使用    `sql_text`    只能解析小于1000字符的SQL，超过则忽略，等支持    `sql_fulltext`    字段后支持解析超过1000字符的完整SQL
1. 目前只支持针对LSC表AC，其他类型的表暂时忽略
1. 发现的AC暂时只针对X, Y列，    `bound`    ，    `include`    ，    `filter`    等暂不涉及
1. SQL文件中默认schema为SYS，若使用SQL文件作为输入，则除SYS用户外需指明表的schema
1. 忽略    `select *`    ，    `select count(*)`    等无投影列的SQL语句
1. 投影列 + 谓词列 <= 31
1. 指定的SQL文件限制默认大小为200M，SQL条数为100万条，yasdb.env中可配置
1. AC代价排序现只支持单机，暂不支持分布式（分布式的DBMS_STATS.GATHER_TABLE_STATS暂不支持，无法获取到表统计信息）


# **3. 测试组网**

当前SR只支持单机，需要通过yasboot部署才能验证此功能，测试组网1主2备。

![](https://pingcode.yasdb.com/atlas/files/public/673969628970c2af4f51f7c0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcwMzcsImV4cCI6MTc4MjEzNzgzN30.OaOQn184dxhF7QpXH0LGKuQNeO3c53O-8RXr_XwiX2k)

# 4.   **测试设计方法**

测试设计采用边界值，等价类以及正交，场景法等。

# 5.   **详细测试设计**

[om支持单机ac发现1.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjI4OTcwYzJhZjRmNTFmN2JkIiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMjk4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDM3LCJleHAiOjE3ODIyMTM0Mzd9.z0POKHXX0nhnDoCaSEEb3vd7GnjbreMK0dgPp7cMM_o)

# 6.   **测试用例**

参考上面详细设计

# 7.   **测试框架设计**

采用单机安装部署框架

# 8.   **测试环境说明**

|服务器类型|操作系统|服务器个数|
|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|2|


## Attachments:

[OM支持单机AC发现.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjI4OTcwYzJhZjRmNTFmN2JlIiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMjk4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDM3LCJleHAiOjE3ODIyMTM0Mzd9.pEPl6hfdg5wgR1IqB0AzTIzSn7q6e9bgn89mSm8cgpE)

 (application/x-xmind)    


[image2023-5-11_14-37-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjI4OTcwYzJhZjRmNTFmN2JmIiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMjk4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDM3LCJleHAiOjE3ODIyMTM0Mzd9.VDcjzXPz8gom2nG9augoq38e1G91_jXDm8MA44mIlno)

 (image/png)    


[image2022-4-13_11-10-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjJhMWFkOWEzMzExZGM3NjM2IiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMjk4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDM3LCJleHAiOjE3ODIyMTM0Mzd9.rJNyojybqpNQ0g5KlWgw0r8LSXKMfRO7R957v1RzaQU)

 (image/png)    


[om支持单机ac发现1.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjI4OTcwYzJhZjRmNTFmN2JkIiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMjk4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDM3LCJleHAiOjE3ODIyMTM0Mzd9.z0POKHXX0nhnDoCaSEEb3vd7GnjbreMK0dgPp7cMM_o)

 (application/x-xmind)    
