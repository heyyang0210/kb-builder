Created by 施新华, last modified on 十月 31, 2023

# 1.   **概述**

通过查询SQL，OM根据算法推导出AC列表供用户选择。采用yasboot命令，  可以使用  预定义的SQL集合或者使用    `v$sqlarea`    中的SQL语句  作为输入，然后输出AC列表。

SR：    [YDBRD-13313](https://jira.yasdb.com/browse/YDBRD-13313?src=confmacro)    -  【OM】OM支持单机数据库AC发现能力  完成

# 2.   **需求分析**

### **2.1 功能分析**

1. 获取用户输入的SQL或从Cache中获取SQL，输出AC列表；
1. 解析SQL并输出查询中特定表的相关投影列和谓词列，可以输出对应表AC列表。


####  2.1.1 业务流程

![](https://conf.yasdb.com/download/attachments/107389599/sequence01.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcwNDcsImV4cCI6MTc4MjEzNzg0N30.iA3yaXZKNzn4UZ8NjmGS47inXLmrnXC6XJhWw50yqVY)

1. 从v$sqlarea或文件中获取SQL；
1. 解析SQL；
1. 获取数据库统计信息；
1. 过滤不符合条件的SQL；
1. 代价计算，对AC进行评估（暂未设计）；
1. 并集选择，是否合并同一个表的多条AC的评估（暂未设计）；
1. 生成AC列表；
1. 根据代价信息进行推荐排序（暂未实现）；
1. 返回并输出在客户端或文件。


#### 2.1.2 SQL解析流程图

![](https://conf.yasdb.com/download/attachments/107389599/flow-chart01.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcwNDcsImV4cCI6MTc4MjEzNzg0N30.iA3yaXZKNzn4UZ8NjmGS47inXLmrnXC6XJhWw50yqVY)

1. 若提供SQL文件，则读取文件获得SQL语句集，过滤非查询语句；
1. 若为提供SQL文件，从    `v$sqlarea`    中获取历史SQL，由于    `v$sqlarea`    暂未支持    `sql_fulltext`    ，    `sql_text`    最大只存1000个字符；
1. 使用yasparse解析SQL，生成SQL信息的集合。


2.1.3 过滤SQL信息集合

![](https://conf.yasdb.com/download/attachments/107389599/flow-chart02.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcwNDcsImV4cCI6MTc4MjEzNzg0N30.iA3yaXZKNzn4UZ8NjmGS47inXLmrnXC6XJhWw50yqVY)

1. 上一步SQL解析已获取SQL信息集合；
1. 获取已存在表和已存在AC信息；
1. 合并相等或包含关系的列组合；
1. 过滤非LSC表的SQL；
1. 已存在AC对新AC为相等或包含关系，则过滤。


#### 2.1.4 yasboot命令参数

       yasboot  discovery  ac

|参数|选项|说明|
|:---|:---|:---|
|-c, --cluster|必选|YashanDB的集群名（必传参数）|
|--file|可选|指定SQL文件，与history二选一|
|--history|可选|使用记录的历史SQL，与file二选一|
|--explain|可选|指定SQL文件检查SQL正确性|
|-s, --schema|可选|指定SQL文件的schema，默认为SYS|
|-sp, --schema-password|可选|指定schema的密码，SYS用户不需要输入密码|
|-f, --force|可选|跳过explain参数的确认提示|
|-m, --mode|可选|指定AC发现模式，可选'NORMAL'和'BASE'分别为正常模式和基础模式|
|-o, --output|可选|指定输出路径，生成AC列表文件|
|--parallelism|可选|explain和解析SQL的并行度，范围为1-16，默认为1|


       参考：    [AC自动发现方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=107389599)  

### 2.2 规格约束

#### 2.2.1 规格

1. 谓词列作为X，投影列作为Y；
1. 没有谓词列使用    `on only`    只添加Y列；
1. 新建AC的XY列不能和已有AC的XY列重复；
1. 投影列和谓词列有列重复时，去重，投影列优先；
1. 自动生成不存在且不重复的AC名称；
1. 指定的SQL文件限制默认大小为200M，SQL条数为100万条，yasdb.env中可配置。
1. yasboot并行解析最大支持16并发；
1. 发现AC的投影列 + 谓词列 <= 31。


#### 2.2.2 约束

1. 暂不支持推荐跨表AC；
1. 历史SQL仅限于PlanCache(v$sqlarea)中保存的；
1.   `v$sqlarea`    暂不支持    `sql_fulltext`    ，使用    `sql_text`    只能解析小于1000字符的SQL，超过则忽略，等支持    `sql_fulltext`    字段后支持解析超过1000字符的完整SQL；
1. 目前只支持针对LSC表AC，其他类型的表暂时忽略；
1. 发现的AC暂时只针对X, Y列，    `bound`    ，    `include`    ，    `filter`    等暂不涉及；
1. SQL文件中默认schema为SYS，若使用SQL文件作为输入，则除SYS用户外需指明表的schema；
1. 忽略    `select *`    ，    `select count(*)`    等无投影列的SQL语句；
1. 目前只支持发现AC，AC是否能执行成功未校验；
1. 通过yasboot部署单机才可以使用该功能，通过OM找到primary节点连接进行表信息校验以及查询视图等；
1. yasboot命令执行之前需要先创建表；
1. SQL中同一个表不同子查询，第三方解析parse合并为一个查询，因此只能发现一条AC  。


# **3. 测试组网**

当前SR只支持单机，需要通过yasboot部署才能验证此功能，测试组网1主2备。

![](https://pingcode.yasdb.com/atlas/files/public/67396963a1ad9a3311dc7642/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcwNDcsImV4cCI6MTc4MjEzNzg0N30.iA3yaXZKNzn4UZ8NjmGS47inXLmrnXC6XJhWw50yqVY)

# 4.   **测试设计方法**

测试设计采用边界值，等价类以及正交，场景法等。

# 5.   **详细测试设计**

[OM支持单机AC发现.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjNhMWFkOWEzMzExZGM3NjNjIiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMmE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDQ3LCJleHAiOjE3ODIyMTM0NDd9.T9Ub-a34SUCpzcxRa_HhDW40i7uvZIPwYrW31W4KIOM)

# 6.   **测试用例**

参考上面详细设计

# 7.   **测试框架设计**

采用单机安装部署框架

# 8.   **测试环境说明**

|服务器类型|操作系统|服务器个数|
|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|2|


## Attachments:

[image2022-4-13_11-10-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjNhMWFkOWEzMzExZGM3NjNkIiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMmE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDQ3LCJleHAiOjE3ODIyMTM0NDd9.v_sXeE-q5NmC6xW7Vp5FvLBukVT6RK2JU_TkkxqFxJI)

 (image/png)    


[image2023-5-11_14-37-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjNhMWFkOWEzMzExZGM3NjNlIiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMmE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDQ3LCJleHAiOjE3ODIyMTM0NDd9.8oqnD-stCM1Yv2gbpzvbn7pOR_fBaXiHMr-fzBQqKEo)

 (image/png)    


[OM支持单机AC发现.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjNhMWFkOWEzMzExZGM3NjNjIiwicmVmX2lkIjoiNjczOTY5NjI3MjgyMDZlZmI5MmVmMmE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MDQ3LCJleHAiOjE3ODIyMTM0NDd9.T9Ub-a34SUCpzcxRa_HhDW40i7uvZIPwYrW31W4KIOM)

 (application/x-xmind)    
