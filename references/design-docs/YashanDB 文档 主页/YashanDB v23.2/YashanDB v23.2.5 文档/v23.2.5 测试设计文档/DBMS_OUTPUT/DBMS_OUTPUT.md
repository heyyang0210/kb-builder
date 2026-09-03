Created by 唐文林, last modified by  李美娥 on 六月 21, 2024

|  
|测试点|测试点细化|备注|
|---|---|---|---|
|1|分布式cn节点支持output。dn、mn节点不支持，要有拦截用例|1、所有子函数在cn节点正常执行（复用单机用例）,2、cn1设置buffer的大小，不影响cn2。,3、cn1，cn2并发执行|  
|
|2|权限校验（主要涉及存储过程权限）|1、覆盖基本权限校验（现在没有权限也能使用内置高级包）,2、赋予所有权限，然后一条一条revoke回收。看对高级包的使用是否有影响,补充：,历史的高级包：DBMS_AUDIT_MGMT、DBMS_AWR、DBMS_DESCRIBE、DBMS_PICKLER、OWA_UTIL均是用udp实现的，之前均有权限问题(output暂时不管，后续对应的高级包看是否要补充用例）,(1)单独针对DBMS_OUTPUT的权限补充：oracle有如下权限的用户，切换到这个用户下去执行高级包，不切换直接sys用户执行但是对象在如下用户名下。    [Oracle数据库角色管理（三）_oracle角色管理选项-CSDN博客](https://blog.csdn.net/Keep_Trying_Go/article/details/127128053)  ,connect,resource,SELECT_CATALOG_ROLE用户,dba权限用户    
,sys用户,public,AUDIT_ADMIN,SECURITY_ADMIN,SYSOPER,SYSDBA,AUDIT_VIEWER,ALTER SESSION SET current_schema=user2； --还有这种，比如public的角色，先不给session的权限，你执行高级包，看是否能成功,(2)2个用户，一个仅connect权限，调度另外一个用户下创建的func，func里面使用了高级包，无权限，给这个func创建public的同名词，connect的用户登陆调度同名词，可以打印输出,(3)2个用户，一个仅connect权限，调度另外一个用户下创建的procedure，proc里面使用了高级包，无权限，给这个connect的用户GRANT EXECUTE ANY PROCEDURE TO 的权限，然后connect用户再去执行procedure。,  
|  
|
|3|各个函数的入参使用绑定参数|  
|  
|
|4|put line打印blob类型、put line循环打印（循环打印行的次数非常大。数据可以小一些）|  
|  
|
|5|put+put_line打印总长度为32000|  
|  
|
|6|ha主备|1、主备使用output。备机不支持output（与Oracle规格差异）|  
|
|7|开启并行，查看各个函数使用是否正常|  
|三层已有用例|
|  
|  
|  
|  
|
|  
|  
|  
|  
|


![](https://pingcode.yasdb.com/atlas/files/public/6739a4098970c2af4f52dc11/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTIzMjksImV4cCI6MTc4MjMyMzEyOX0.2cZntBInbbAzF15gZxqXMu1VBZ6W2SjxtozCgx4krjU)

## Attachments: