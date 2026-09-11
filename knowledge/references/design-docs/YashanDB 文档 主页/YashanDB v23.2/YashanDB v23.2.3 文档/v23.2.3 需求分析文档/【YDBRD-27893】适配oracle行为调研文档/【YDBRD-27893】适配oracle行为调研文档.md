Created by 方少奎, last modified on 二月 29, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=144136593#1-%E6%80%BB%E8%BF%B0)  

IR链接：    [YDBRD-27180](https://jira.yasdb.com/browse/YDBRD-27180)  

SR链接：    [YDBRD-27893](https://jira.yasdb.com/browse/YDBRD-27893)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=144136593#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

为了让用户从Oracle无修改迁移到YaShanDB，YaShanDB-JDBC需要适配Oracle行为。

###   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

- 为了适配oracle行为，对于用户使用varchar(1)类型保存boolean对象时，需要向服务端传递  DataType  .  INTEGER类型。yashan传递boolean类型，导致服务端将boolean转化成“true”或“false”，导致varchar(1)无法保存。
- 为了适配hibernate行为，调用参数绑定接口setNull时，固定数据类型为  DataType  .UNKOWN。hibernate进行setNull时会默认数据类型为VarBinary，yashan服务端不支持VarBinary转化为int，float等类型。


![](https://pingcode.yasdb.com/atlas/files/public/67396d62a1ad9a3311dc90dd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk1MTEsImV4cCI6MTc4MjMyMDMxMX0.6ca61HtSh_hkaf6qg0J_-LM3RI6n9lYIwdpCK1AtvTw)

- 为了满足oracle迁移用户需求，添加参数product name配置。


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=144136593#2-%E6%8E%A5%E5%8F%A3)  

- 对于用户使用varchar(1)类型保存boolean对象时，需要向服务端传递  DataType  .  INTEGER类型。


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|PreparedStatementImpl.setBoolean  (  int     index  ,     boolean     x  )|参数：,int 参数绑定下标,boolean 绑定值|绑定参数时，向服务端传递  DataType  .  INTEGER|是|


- 调用参数绑定接口setNull时，固定数据类型为  DataType  .UNKOWN。


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SimpleParameterList.setNull  (  int     index  ,     int     oid  )|参数：,int 参数绑定下标,int 绑定类型SQLTypes|绑定参数setNull时，向服务端传递  DataType  .  UNKOWN|是|


- 添加参数product name配置。


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|YasDatabaseMetaData.getDatabaseProductName  ()|返回值：String|返回产品名称，根据配置  product name，默认返回YaShanDB|是|


  


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=144136593#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


## Attachments:

[image2024-2-29_9-50-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjJhMWFkOWEzMzExZGM5MGRjIiwicmVmX2lkIjoiNjczOTZkNjI3MjgyMDZlZmI5MmYxZTZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5NTExLCJleHAiOjE3ODIzOTU5MTF9._Kwt5UCULo48BcxM3ej_MtSMrRurNFNpeyDcPBTsK-4)

 (image/png)    
