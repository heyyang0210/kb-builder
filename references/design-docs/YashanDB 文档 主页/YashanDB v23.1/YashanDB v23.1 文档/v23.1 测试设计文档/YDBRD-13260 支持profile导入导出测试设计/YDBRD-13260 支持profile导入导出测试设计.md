Created by 徐瑶, last modified on 十月 31, 2023

1. 概述 

支持用户资源配置信息Profile的导入导出

# 2. 需求分析 

SR：    [YDBRD-13260](https://jira.yasdb.com/browse/YDBRD-13260?src=confmacro)    -  【imp/exp】支持profile导入导出  完成

开发文档：    [YDBRD-13260:支持profile导入导出](104232404.html)  

## 2.1语法

create profile

![](https://conf.yasdb.com/download/attachments/104232404/image2023-4-17_16-38-12.png?version=1&modificationDate=1681720693000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY5NTYsImV4cCI6MTc4MjIxNzc1Nn0.mYlNAaId9Ng62cID7Q-xfmiTKN8zHp_aA6tO8OI1WSo)

密码策略所有参数列示如下：

|参数|对应策略|默认值|
|---|---|---|
|FAILED_LOGIN_ATTEMPTS|帐户被锁定之前可以错误尝试的次数|10次|
|PASSWORD_LOCK_TIME|超过错误尝试次数后用户被锁定的天数|1天|
|PASSWORD_LIFE_TIME|密码可以被使用的天数（生命长度）|UNLIMITED不限制天数|
|PASSWORD_GRACE_TIME|密码过期之后还可宽限多少天使用原密码（额外宽限期）|UNLIMITED无限宽限|
|PASSWORD_REUSE_TIME|密码可复用的间隔时间|UNLIMITED无限复用|
|PASSWORD_REUSE_MAX|密码满足可复用的必要变更次数    
  假设其为N，则表示新密码不能被设置为最近N次使用过的密码|UNLIMITED无限复用|


alter profile

![](https://conf.yasdb.com/download/attachments/95114113/image2022-12-13_11-19-23.png?version=1&modificationDate=1670901563439&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY5NTYsImV4cCI6MTc4MjIxNzc1Nn0.mYlNAaId9Ng62cID7Q-xfmiTKN8zHp_aA6tO8OI1WSo)

drop profile

![](https://conf.yasdb.com/download/attachments/95114113/image2022-12-13_11-20-25.png?version=1&modificationDate=1670901625469&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY5NTYsImV4cCI6MTc4MjIxNzc1Nn0.mYlNAaId9Ng62cID7Q-xfmiTKN8zHp_aA6tO8OI1WSo)

关联用户：

**alter user username profile profile_name;**

DBA_PROFILES视图

![](https://pingcode.yasdb.com/atlas/files/public/673969888970c2af4f51f8ee/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDY5NTYsImV4cCI6MTc4MjIxNzc1Nn0.mYlNAaId9Ng62cID7Q-xfmiTKN8zHp_aA6tO8OI1WSo)

DBA_USERS视图

|字段|类型|说明|
|---|---|---|
|USERNAME|VARCHAR(64)|用户名|
|PROFILE|VARCHAR(128)|用户对应的PROFILE名称|


  


验证方式：

未与用户关联导出后清理profile,导入后检查DBA_PROFILES视图信息,应与预期一致

与用户关联，导出后清理用户及关联的profile,导入后检查DBA_PROFILES视图和DBA_USERS视图信息,应与预期一致

## 2.2 规格限制

（1）导出：全库导出带profile信息，tables/user不带

（2）导入：全库导出带profile信息，tables/FROMUSER不带

（3）profile的资源限制，没有做，目前仅支持密码相关限制。

（4）用户与profile的关联：SYS/非SYS。

## 2.3 部署模式

仅支持单机，分布式部署中用户无法创建profile

# 3. 测试设计方法 

主要采用的等价类划分，场景法组合及错误推测法进行设计 

# 4. 详细测试设计

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|profile_name|1.profile名称,（1）英文（大小写）,（2）中文,（3）特殊字符,（4）混合等,2.是否带有双引号|  
|  
|  
|
|密码策略参数|1.全部参数不进行设置（使用默认）,2.全部进行设置,（1）自定义值（具体值或者表达式运算）、UNLIMITED（  不对该参数对应资源进行限制）、  DEFAULT自由组合,（2）包含空字符串,3.部分进行设置（自由组合）,（1）自定义值（具体值或者表达式运算）、UNLIMITED（  不对该参数对应资源进行限制）、  DEFAULT自由组合,（2）包含空字符串,4.存在多个内容相同的profile|1.导出时limit  全是DEFAULT,  
,3.未设置的参数导出时值为DEFAULT|  
,  
|  
|
|导入导出模式|full=y模式导出,(1).full=y导入,(2).full=n导入,(3).  schema  导入,(4).  table  导入,  
|1.全库导出带profile,（1）profile导入,（2）profile不导入,（3）profile不导入,（4）profile不导入|导入导出模式为schema模式,导入导出模式为tables模式|不导出profile|
|关联用户|1.不关联用户,（1）profile个数,         1个，2个，多个,（2）导入时profile是否存在,    a.全部不存在（全部删除）,    b.全部存在,    c.部分存在（部分删除）,（3）  profile的alter,    创建好profile之后，改变密码策略参数导出导入,    创建好profile导出，改变密码策略参数再导入,(只检测同名）|结合ignore=n/y|  
|  
|
|  
|2.关联sys,（1）不关联profile直接导出导入,（2）导出后添加关联profile再导入（profile重名）,（3）先添加关联profile再导出导入,（4）关联profile1先导出，修改profile1内容进行导入（profile重名）|  
|  
|  
|
|  
|3.关联其他用户,（1）单个用户,         a.创建时不指定profile直接导出导入,         b.创建时不指定profile,alter添加关联导出导入,         c.创建时关联profile 导出导入,创建时关联profile 导出，删除user重建用户不关联profile再导入（user重名）,         创建时关联profile 导出，修改关联的profile内容后导入（profile重名）,（2）多个用户,         多个用户未关联profile进行导出导入,         多个用户关联同一个profile进行导出导入,创建时关联profile 导出，删除user重建用户不关联profile再导入（user重名）,创建时关联profile 导出，修改关联的profile内容后导入（profile重名）,         多个用户关联不同的profile进行导入导出,创建时关联profile 导出，删除user重建用户不关联profile再导入（user重名）,创建时关联profile 导出，修改关联的profile内容后导入（profile重名）|用户未关联profile，默认关联  系统默认的profile|  
|  
|
|导入导出时的用户|登录用户必须具有dba权限|  
|无dba权限登录|  
|


# 5. 测试用例 

# 6. 测试框架设计

本次测试采用导入导出测试框架实现，执行py文件，对导入后视图（DBA_PROFILES、DBA_USERS）进行检验。

# 7. 测试环境说明

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[image2023-4-23_11-2-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ODg4OTcwYzJhZjRmNTFmOGVjIiwicmVmX2lkIjoiNjczOTY5ODg3MjgyMDZlZmI5MmVmNDFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2OTU2LCJleHAiOjE3ODIyOTMzNTZ9.iC1UtjvYtTu7m_PK7A38rfwNH1v8zM_7DS-L7Xn9fzs)

 (image/png)    


[image2023-4-23_11-3-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ODhhMWFkOWEzMzExZGM3NzYyIiwicmVmX2lkIjoiNjczOTY5ODg3MjgyMDZlZmI5MmVmNDFhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2OTU2LCJleHAiOjE3ODIyOTMzNTZ9.2vGzTGDKbq7OTzpAoDerjREDxGnyxrmvIIck-de6Hzw)

 (image/png)    
