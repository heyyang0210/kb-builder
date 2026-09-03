Created by 邬建川, last modified on 四月 25, 2024

  


##   [1. 总述](#1-总述)  

调研oracle v$session视图中的audsid参数

参考链接：

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SESSION.html](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SESSION.html)     [1]

  [https://blog.csdn.net/tianlesoftware/article/details/7239890](https://blog.csdn.net/tianlesoftware/article/details/7239890)     [2]

  [https://asktom.oracle.com/ords/f?p=100:11:0::::P11_QUESTION_ID:65212348056](https://asktom.oracle.com/ords/f?p=100:11:0::::P11_QUESTION_ID:65212348056)     [3]

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/dbseg/configuring-audit-policies.html#GUID-6801720F-6020-4608-93B9-C08478B36121](https://docs.oracle.com/en/database/oracle/oracle-database/19/dbseg/configuring-audit-policies.html#GUID-6801720F-6020-4608-93B9-C08478B36121)     [4]

###   [1.1 需求合理性分析](#11-需求合理性分析)  

需求来源： oracle兼容

###   [1.2 需求实现分析](#12-需求实现分析)  

略

###   [1.3 数据字典](#13-数据字典)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|audsid|审计会话id|是|  [https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SESSION.html](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-SESSION.html)  |


###   [1.4 开源依赖](#14-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|动态视图|v$session:  audsid|审计会话id，对于unified auditing这一列展示unified auditing session id|是|
|内置函数|userenv('sessionid')|同审计会话id|是|


##   [3. 规格与约束](#3-规格与约束)  

- oracle支持 unified auditing以及 mixed auditing， 当前yashandb的审计是纯 unified auditing
- 在unified auditing下 audsid 等同与 userenv('sessionid')（参见链接4）
- audsid字段在oracle 10g后取值的具体方式是： 对于内部session 为 0， 外部sys用户连接的session为 UB4MAX(4294967295) 其他用户连接为 audses$的nextval （参见链接2）
- oracle audses$ sequence的初始化参数值如下


![](https://pingcode.yasdb.com/atlas/files/public/67396d588970c2af4f52122b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBSUFBQUNBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQVFBQUFBQUFBQUFBUkNCQUFBRUFBQUFBUUFBQUFBQUFBQUpBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk0OTAsImV4cCI6MTc4MjMyMDI5MH0.g9jyDCqUVFVfTrS1DnaBkL7o_wHRd5wMdI8-6XP-Fb0)

  


**audSid的取值范围是 0~max_uint32**  如果设置sequence的范围超过了max_uint32. 并且连接取到了这么大的序列数，则展示出来的audsid就是max_uint32

![](https://pingcode.yasdb.com/atlas/files/public/67396d58a1ad9a3311dc909d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBSUFBQUNBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQVFBQUFBQUFBQUFBUkNCQUFBRUFBQUFBUUFBQUFBQUFBQUpBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk0OTAsImV4cCI6MTc4MjMyMDI5MH0.g9jyDCqUVFVfTrS1DnaBkL7o_wHRd5wMdI8-6XP-Fb0)

如果设置sequence的范围小于0(minvalue < 0), 并且连接取到了这么小的数，则展示出来的audsid是0

![](https://pingcode.yasdb.com/atlas/files/public/67396d588970c2af4f52122c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBSUFBQUNBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQVFBQUFBQUFBQUFBUkNCQUFBRUFBQUFBUUFBQUFBQUFBQUpBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk0OTAsImV4cCI6MTc4MjMyMDI5MH0.g9jyDCqUVFVfTrS1DnaBkL7o_wHRd5wMdI8-6XP-Fb0)

![](https://pingcode.yasdb.com/atlas/files/public/67396d588970c2af4f52122d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBUUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBSUFBQUNBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUlBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQVFBQUFBQUFBQUFBUkNCQUFBRUFBQUFBUUFBQUFBQUFBQUpBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFFQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDk0OTAsImV4cCI6MTc4MjMyMDI5MH0.g9jyDCqUVFVfTrS1DnaBkL7o_wHRd5wMdI8-6XP-Fb0)

##   [4. 功能依赖](#4-功能依赖)  

无

## Attachments:

[image2024-4-25_18-37-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTdhMWFkOWEzMzExZGM5MDlhIiwicmVmX2lkIjoiNjczOTZkNTc3MjgyMDZlZmI5MmYxZGM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA5NDkwLCJleHAiOjE3ODIzOTU4OTB9.GvAFXK2yyKOZp84DpJ3b52sqS0cFV-1isAAOYB-yDgE)

 (image/png)    
