Created by 冯皓博, last modified on 四月 02, 2024

*IR链接：*    [YDBRD-28446](https://jira.yasdb.com/browse/YDBRD-28446?src=confmacro)    *-*  *龙华政数艺术展示平台ODBC适配支持*  *开发中*

*SR链接：*    [YDBRD-28543](https://jira.yasdb.com/browse/YDBRD-28543?src=confmacro)    *-*  *【odbc】支持相关接口调通PHP项目调用odbc流程*  *待启动*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

支持OBC SQLGetData、  SQLParamData+SQLExecute相关逻辑。本质是支持单格大批量数据分批导入。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

龙华政数艺术展示平台ODBC适配支持

**单机**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

发送LONG数据流程：

  [https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/sending-long-data?view=sql-server-ver16](https://learn.microsoft.com/zh-cn/sql/odbc/reference/develop-app/sending-long-data?view=sql-server-ver16)  

#### 接口调用流程图：

![](https://pingcode.yasdb.com/atlas/files/public/67396cc68970c2af4f520e41/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFRQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBUUFCQUFBQUFBQUFBZ0FBQUFBQUFDQUFBQUFBQUFBQUNBQUFBQUFBRUFBRUFBQUFBQ0FFQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzNTksImV4cCI6MTc4MjMxNDE1OX0.pVjVp7NrWZEQ44gq5ib5bcmQqo6PDlR6CohrpqA7CKw)

#### 实际接口调用示例：

数据：

![](https://pingcode.yasdb.com/atlas/files/public/67396cc6a1ad9a3311dc8cb2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFRQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBUUFCQUFBQUFBQUFBZ0FBQUFBQUFDQUFBQUFBQUFBQUNBQUFBQUFBRUFBRUFBQUFBQ0FFQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzNTksImV4cCI6MTc4MjMxNDE1OX0.pVjVp7NrWZEQ44gq5ib5bcmQqo6PDlR6CohrpqA7CKw)

接口调用：

![](https://pingcode.yasdb.com/atlas/files/public/67396cc68970c2af4f520e42/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFRQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBUUFCQUFBQUFBQUFBZ0FBQUFBQUFDQUFBQUFBQUFBQUNBQUFBQUFBRUFBRUFBQUFBQ0FFQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzNTksImV4cCI6MTc4MjMxNDE1OX0.pVjVp7NrWZEQ44gq5ib5bcmQqo6PDlR6CohrpqA7CKw)

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|----|
|  
|子功能2|子功能2通过什么方案满足|是/否|是/否|----|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|----|
|  
|性能场景2|----|是/否|是/否|----|
|可用性|恢复场景|----|是/否|是/否|----|
|可靠性|故障场景|----|是/否|是/否|----|
|可维可测|DFX功能1|----|是/否|是/否|----|
|  
|DFX功能2|----|是/否|是/否|----|
|安全|安全场景1|----|是/否|是/否|----|
|易用性|----|----|是/否|是/否|----|
|可修改性|----|----|是/否|是/否|----|
|兼容性|----|----|是/否|是/否|----|
|周边配合|权限|----|----|是/否|----|
|周边配合|审计|----|----|是/否|----|
|周边配合|导入导出工具|----|----|是/否|----|


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#2-%E6%8E%A5%E5%8F%A3)  

|接口|具体支持项|含义|合法值|
|:---|:---|---|---|
|SQLGetInfo|SQL_NEED_LONG_DATA_LEN|是否支持     SQL_DATA_AT_EXEC|”N“|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1、  SQLExecDirect不支持绑定出入参

2、不支持出参使用SQLGetData+SQLParamData获取数据

3、动态绑定indicator不是数组，而且在SQLExecute时处理

4、动态绑定对buf长度没有要求，只要是非负数都可以

5、动态绑定要求动态扩充绑定buf

6、最后一个SQLParamData进行非动态绑定数据的拷贝

7、SQLExecute 返回SQL_NEED_DATA后无法进行绑定：需要确认该拦截是驱动程序管理器完成还是驱动程序完成

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性功能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#41-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

##   [5.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

  


## Attachments: