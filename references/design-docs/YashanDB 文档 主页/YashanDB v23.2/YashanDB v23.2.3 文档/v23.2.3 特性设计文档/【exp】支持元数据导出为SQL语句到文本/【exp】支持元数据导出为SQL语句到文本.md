Created by 程康, last modified on 六月 04, 2024

##   [1. 总述](#1-总述)  

exp 导出元数据sql到文本

现有可参考：    [导出--sql文本 - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119542034)  

###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

  [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

配置后导出 元数据sql到文件

```
exp --sql user1/1 tables=t1,t2,t3,user2.t1,user2.t2,user2.t3 file=a 导出元数据到脚本

exp --sql user1/1 file=a owner=user1

exp --sql user1/1 file=a full=y
```

  [3. 规格与约束](#3-规格与约束)  

导出范围： 表 + 表的约束 范围同 exp tables模式导出的所有对象（不包含数据）

##   [4. 特性](#4-特性)  

元数据导出：

![](https://pingcode.yasdb.com/atlas/files/public/67396d5aa1ad9a3311dc90b3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2NDEsImV4cCI6MTc4MjMxODQ0MX0.2I2TsXs_phMiJp6i6mJtkQ34fweMtTVygPExf1Hoae0)

```
exp --sql sys/Cod-2022 file=x tables=test1 rows=n file=x
imp sys/Cod-2022 file=x tables=test1 rows=n file=x
```

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

完善资料页面

##   [7.未来规划](#7未来规划)  

  


  


## Attachments:

[image2024-3-20_14-40-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWE4OTcwYzJhZjRmNTIxMjNmIiwicmVmX2lkIjoiNjczOTZkNWE3MjgyMDZlZmI5MmYxZGVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjQxLCJleHAiOjE3ODIzOTQwNDF9.ceEX0VMHccZXtZh5d2Uyn9j-03-PYBaQ82OVFZdj3pA)

 (image/png)    


[image2024-1-19_16-15-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWE4OTcwYzJhZjRmNTIxMjQwIiwicmVmX2lkIjoiNjczOTZkNWE3MjgyMDZlZmI5MmYxZGVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjQxLCJleHAiOjE3ODIzOTQwNDF9.HDURfPPKTl680t4QFsgTb9OSCbXp4uDMo9-ulJQvq4w)

 (image/png)    


[image2024-1-19_16-13-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWE4OTcwYzJhZjRmNTIxMjQxIiwicmVmX2lkIjoiNjczOTZkNWE3MjgyMDZlZmI5MmYxZGVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjQxLCJleHAiOjE3ODIzOTQwNDF9.2EQRx0IO7dd-oFTtYnZEc9z0E2irXx9bDX_PJ19dptA)

 (image/png)    


[image2024-5-29_14-15-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWE4OTcwYzJhZjRmNTIxMjQyIiwicmVmX2lkIjoiNjczOTZkNWE3MjgyMDZlZmI5MmYxZGVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjQxLCJleHAiOjE3ODIzOTQwNDF9.OljHun2lh5Iia4ygnya5-muCt-N4HKUJGkw84pCaWeI)

 (image/png)    


[image2024-5-29_14-15-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWFhMWFkOWEzMzExZGM5MGIyIiwicmVmX2lkIjoiNjczOTZkNWE3MjgyMDZlZmI5MmYxZGVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjQxLCJleHAiOjE3ODIzOTQwNDF9.eAE40ND070E-V8XMxFZDJNazv8tpkQlkhmy04KswsYs)

 (image/png)    


## Comments:

|  [](null)  ,1、元数据范围：角色权限 不包括,2、,Posted by chengkang at 六月 04, 2024 15:19|
|---|
|  [](null)  ,权限：角色/系统权限/对象权限。   其中，对象权限，由于存在切换loginId，sql无法搞定，只能通过协议+权限搞。这个地方先不支持。    角色/系统权限。可以支持,Posted by shixin at 六月 04, 2024 15:29|
