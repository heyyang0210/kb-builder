Created by 张锐, last modified on 五月 21, 2024

  


#   [YDBRD-26538](#ydbrd-26538)  

IR链接：    [YASHAN-824  用户支持设置连接的IP黑白名单](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b288)  

SR链接：    [YDBRD-26538 用户支持设置连接的IP黑白名单](https://pingcode.yasdb.com/pjm/items/6625bd30fd997db58ade35c5)  

##   [1. Overview（概述）](#1-overview概述)  

profile支持设置连接ip的黑白名单

需求范围：单机和集群

##   [2. Features（功能特性）](#2-features功能特性)  

支持profile配置参数invited_nodes和excluded_nodes。

数据库级别的IP黑白名单是先于用户级别的IP黑白名单检查的。

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
CREATE_PROFILE = CREATE PROFILE profile_name LIMIT (resource_parameters | password_parameters | tcp_ip_parameters ) {" " (resource_parameters | password_parameters | tcp_ip_parameters)}.

tcp_ip_parameters = (INVITED_NODES ( (iplist | UNLIMITED | DEFAULT) ) | EXCLUDED_NODES ((iplist | UNLIMITED | DEFAULT))).

iplist = "'" ipliststr "'".


```

![](https://pingcode.yasdb.com/atlas/files/public/67396d3c8970c2af4f521150/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFRQUFBQUFBQUFDQUFBUUFBQUFBQUFBQUVBQUFRZ0FBQUJBUUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFDQUFBQUFBQUFBQUJBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFFQUFRQUFLQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4MjQsImV4cCI6MTc4MjMxNzYyNH0.mEDECm4wXXX2d5eYF5FjQ1WBrOQIP3nPsI-n5LO-tc4)

![](https://pingcode.yasdb.com/atlas/files/public/67396d3ca1ad9a3311dc8fc0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFRQUFBQUFBQUFDQUFBUUFBQUFBQUFBQUVBQUFRZ0FBQUJBUUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFDQUFBQUFBQUFBQUJBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFFQUFRQUFLQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4MjQsImV4cCI6MTc4MjMxNzYyNH0.mEDECm4wXXX2d5eYF5FjQ1WBrOQIP3nPsI-n5LO-tc4)

![](https://pingcode.yasdb.com/atlas/files/public/67396d3c8970c2af4f521151/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFRQUFBQUFBQUFDQUFBUUFBQUFBQUFBQUVBQUFRZ0FBQUJBUUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFDQUFBQUFBQUFBQUJBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFFQUFRQUFLQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4MjQsImV4cCI6MTc4MjMxNzYyNH0.mEDECm4wXXX2d5eYF5FjQ1WBrOQIP3nPsI-n5LO-tc4)

![](https://pingcode.yasdb.com/atlas/files/public/67396d3ca1ad9a3311dc8fc1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFRQUFBQUFBQUFDQUFBUUFBQUFBQUFBQUVBQUFRZ0FBQUJBUUFBQUFBQUFBQUFBQ0FBQUFBQUFBZ0FBQUFDQUFBQUFBQUFBQUJBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFFQUFRQUFLQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4MjQsImV4cCI6MTc4MjMxNzYyNH0.mEDECm4wXXX2d5eYF5FjQ1WBrOQIP3nPsI-n5LO-tc4)

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

1. 检查tcp, tcps连接的ip
1. invited_nodes设置连接白名单
1. excluded_nodes设置连接黑名单
1. 黑白名单规则与数据库级别的IP黑白名单规则一致，参考    [IP黑白名单](https://conf.yasdb.com/pages/viewpage.action?pageId=83921479)  
1. 黑白名单，各自最多容纳64个
1. open后检查


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

profile相关DDL提供了创建配置项，关联用户与配置项的能力。在该基础能力上添加两个配置项invited_nodes和excluded_nodes。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1](#521)  

新增profile资源，需要适配升级场景。    
  升级脚本中插入新增资源，且将所有profile的新增资源限制值设为默认值，通过alter profile 历史profile limit xxx完成。

####   [5.2.2](#522)  

ProfileDict新增NetConfig字段，ankLogin的时候先检查ip。用户级的IP黑白名单检查时，按照。

profile ip黑白名单检查原则：

- 如果名单存在就检查，不存在就不检查
- unlimited相当于不设置IP黑白名单
- 默认不设置IP黑白名单
- 如果设置invited_nodes = ' ',相当于没有设置白名单
- 如果设置exclude_nodes = ' ',相当于没有设置了黑名单


**编码:**

- netConfigAuth相关（setInvitedNodes，setExcludedNodes）挪入ani，相关结构体也挪入ani
- parse解析黑白IP名单string，获取invited和excluded list
- 重启也需要解析黑白IP名单string
- ankLogin的时候调用netConfigAuth判断


1. anrLoginDigest
1. anrLoginOs


####   [5.2.3](#523)  

ipliststr不能超过8000字节，PROFILE$新增字段VALUE VARCHAR(8000)。parse阶段解析后，创建profile或者修改profile的时候解析ipliststr，保证其正确性写入系统表，并加载到profiledict里。

####   [5.2.4 系统表，系统视图](#524-系统表系统视图)  

- 系统表PROFILE$新增字段：VALUE VARCHAR(8000)，用来存储iplist str。其他资源类型为NULL。
- 对于ip设置，如果没有设置黑白名单，对应limit为UNLIMITED，否则为1
- 视图DBA_PROFILES，对于ip黑白名单显示设置的字符串


###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

升级场景，profile新增配置项，旧版本升级需要添加default profile该配置项。

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

无新增sql语法，审计，权限不涉及。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.资料设计章节](#7资料设计章节)  

create profile, alter profile文档添加新增的资源项目    
    [https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20PROFILE.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20PROFILE.html)      
    [https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20PROFILE.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20PROFILE.html)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

略

## Attachments:

[image2024-5-14_10-18-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2NhMWFkOWEzMzExZGM4ZmJkIiwicmVmX2lkIjoiNjczOTZkM2I3MjgyMDZlZmI5MmYxY2EwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2ODI0LCJleHAiOjE3ODIzOTMyMjR9.-c8XvTkSARtohQLre4TejJisSaPupM97nPdNXk38PUY)

 (image/png)    


[image2024-5-14_10-46-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2NhMWFkOWEzMzExZGM4ZmJlIiwicmVmX2lkIjoiNjczOTZkM2I3MjgyMDZlZmI5MmYxY2EwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2ODI0LCJleHAiOjE3ODIzOTMyMjR9.g8RrOr6vd0_n6HZC3tyJQJTUyxh-yKZZzCiCryDP-1I)

 (image/png)    
