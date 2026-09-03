Created by 任艳芬, last modified on 六月 18, 2024

# 1. 概述

支持用户设置连接的IP黑白名单

SR链接：    [YDBRD-26538 用户支持设置连接的IP黑白名单](https://pingcode.yasdb.com/pjm/items/6625bd30fd997db58ade35c5)  

开发设计：    [PROFILE支持设置用户连接IP黑白名单](153006052.html)  

# 2. 需求分析

## 2.1 功能点分析

1. CREATE/ALTER PROFILE语法支持配置用户连接IP的黑白名单。

```
CREATE_PROFILE = CREATE PROFILE profile_name LIMIT (resource_parameters | password_parameters | tcp_ip_parameters ) {" " (resource_parameters | password_parameters | tcp_ip_parameters)}.

tcp_ip_parameters = (INVITED_NODES ( (iplist | UNLIMITED | DEFAULT) ) | EXCLUDED_NODES ((iplist | UNLIMITED | DEFAULT))).

iplist = "'" ipliststr "'".


```

![](https://pingcode.yasdb.com/atlas/files/public/67396d218970c2af4f521086/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQkFJQUFBQUFJQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJnQUFnQUFBQUFBQUFBQUNBQUFBQWdRVUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBZ0FJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYxMzgsImV4cCI6MTc4MjMxNjkzOH0.QRoQeOqj5srwvNiz2jKJxbgqHN6wxuBM6HvB1Q4R-L4)

![](https://pingcode.yasdb.com/atlas/files/public/67396d228970c2af4f521087/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQkFJQUFBQUFJQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJnQUFnQUFBQUFBQUFBQUNBQUFBQWdRVUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBZ0FJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYxMzgsImV4cCI6MTc4MjMxNjkzOH0.QRoQeOqj5srwvNiz2jKJxbgqHN6wxuBM6HvB1Q4R-L4)

![](https://pingcode.yasdb.com/atlas/files/public/67396d228970c2af4f521088/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQkFJQUFBQUFJQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJnQUFnQUFBQUFBQUFBQUNBQUFBQWdRVUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBZ0FJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYxMzgsImV4cCI6MTc4MjMxNjkzOH0.QRoQeOqj5srwvNiz2jKJxbgqHN6wxuBM6HvB1Q4R-L4)

![](https://pingcode.yasdb.com/atlas/files/public/67396d22a1ad9a3311dc8ef6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBRUFBQUFBQUFBQUFBQkFJQUFBQUFJQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJnQUFnQUFBQUFBQUFBQUNBQUFBQWdRVUNBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQkFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBZ0FJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDYxMzgsImV4cCI6MTc4MjMxNjkzOH0.QRoQeOqj5srwvNiz2jKJxbgqHN6wxuBM6HvB1Q4R-L4)

其中白名单（INVITED_NODES）和黑名单（EXCLUDED_NODES）可以同时设置

其中ipliststr 要求如下：

- 支持IPV4和IPV6
- 支持范围设置，单独设置，设置多个


> 支持范围设置：  例：  127.0.0.1/32  mask范围：[0,32] 意义：黑名单中值为25，则表示从前往后匹配25个比特位全部一致时，拒绝连接  支持单独设置：  例：  192.0.0.1   相当于mask为32，全匹配  支持设置多个，用逗号分开：  例：127.0.0.1/8,127.0.0.1:32

- UNLIMITED和DEFAULT行为一致，和字符串'' 一样，相当于没有设置
- 不能超过8000字节
- 黑白名单个数，各自不能超过64个


2.系统表、视图

- 视图DBA_PROFILES，对于ip黑白名单显示设置的字符串。


## 2.2 应用场景

单机和集群

1.创建profile后，支持创建用户时设置profile，支持ALTER profile对黑白名单做出修改，远程连接时，对ip进行是否可连接判断。

2.创建用户后，支持ALTER user，配置profile，支持ALTER profile对黑白名单做出修改，远程连接时，对ip进行是否可连接判断。

## 2.3 规格约束

1. 检查tcp,tcps 连接的IP
1. 黑白名单设置规则，参考    [IP黑白名单](https://conf.yasdb.com/pages/viewpage.action?pageId=83921479)    ，
1. 其中黑白都不配时默认行为有变化：
1. 规则：
1.先检查黑，再检查白。黑全禁止，白全放行。黑白都配，必须在白内/黑外，才能登录。1. （黑/白重复，以黑为主）
1. 2.当黑白任意一个不配置，则认为其不配置的名单全部通过。


|黑|白|效果|
|:---|:---|:---|
|不配|不配|全部放行|
|不配|配|白为准，白以外，全禁止|
|配|不配|黑为准，黑以外，全放行|
|配|配|先检查黑，再检查白。有冲突以黑为准。|


# 3. 详细测试设计

## 3.1 测试设计方法

- 语法参数设置：等价类划分,不同参数做正交组合验证
- 针对功能：场景覆盖法及错误推测法


## 3.2 详细测试设计

### 3.2.1 create/alter profile

|测试项|参数|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|create profile,alter profile|INVITED_NODES,EXCLUDED_NODES,组合|UNLIMITED+DEFAULT,127.0.0.1/32 + DEFAULT,DEFAULT + 192.168.7.54/8,192.168.7.54，127.0.0.1 + DEFAULT,fe80::13f7:c401:cc5f:5d8e + 192.168.7.54/24 （同一机器的ipv4和ipv6）,192.168.7.54/25 + 192.168.7.54/24,空字符串'',resource+passwd+tcp_ip 组合测试,只设置INVITED_NODES|INVITED_NODES和EXCLUDED_NODES关键字错误,IP格式非法,含有特殊（多余）字符'\n'，':',超过8000字节,非重复超过64个,INVITED_NODES 192.168.7.54/24 192.168.6.178 EXCLUDED_NODES 192.168.7.54 INVITED_NODES 127.0.0.1|UNLIMITED和DEFAULT 默认行为一致,黑白全不设时，全部放行,INVITED_NODES和EXCLUDED_NODES有交集时，交集部分被禁止,INVITED_NODES或者EXCLUDED_NODES 字段出现多次时，报错,结合查视图DBA_PROFILES,只设置INVITED_NODES时，另一个保持不变|


### 3.2.2 场景测试

|编号|测试场景|用例期望|备注|
|---|---|---|---|
|1|create profile 全部默认,create user 时指定 profile,alter profile 只设置白名单，使用白名单内/外ip连接,alter profile 只设置黑名单，使用黑名单内/外ip连接,以上每一步结合查视图DBA_PROFILES和PROFILE$|默认时，所有的均可连接,指定白名单，除了白名单其他的禁止,指定黑名单，除了黑名单其他的放行,视图字段显示正确|单机+集群|
|2|create user,create profile，设置黑名单,alter user A 指定 profile,使用黑名单内/外ip连接,ALTER 黑名单 IP地址位数>白名单 IP地址位数，使用白名单连接 ---- 连接失败,ALTER 白名单 IP地址位数>黑名单 IP地址位数，使用黑名单连接 ---- 连接失败,ALTER 黑名单 192.168.7.54/24，白名单 192.168.7.54 ---- 连接失败,ALTER 白名单 192.168.7.54/24，黑名单 192.168.7.54 –-- 黑名单内失败，前三个字段相同成功,create user B 指定 profile,以上每一步结合查视图DBA_PROFILES和PROFILE$|只配黑名单，黑名单范围内不可连接，其他均可以,黑白都配，白内和黑外的才可连接,视图字段显示正确|单机+集群|
|3|create profile 设置多个黑白名单且有交集,create user A 指定,使用仅黑内ip，使用有交集ip，使用仅白内ip,以上每一步结合查视图DBA_PROFILES和PROFILE$|视图各字段显示正确,使用仅白内ip连接成功,使用仅黑内ip和有交集ip都会失败|单机+集群|
|4|分机部署,create user,create profile，设置黑白名单,alter user 指定 profile 节点1 黑名单,yasql连接主机和备机场景（使用黑名单ip远程连接，使用黑名单外ip连接）|黑外及白内连接成功|分机部署HA|
|5|创建用户指定default_profile,查询视图,yasql连接|连接成功|单机+集群|
|6|数据库mount和nomount状态，进行连接|sys用户连接不校验ip，其他用户报错找不到用户|单机|


### 3.2.3 DFX

|系统级DFX分类|是否涉及|备注|
|:---|:---|---|
|CT|不涉及|  
|
|KT|不涉及|  
|
|长稳|不涉及|  
|
|一致性|不涉及|  
|
|三方测试工具(sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR|不涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|升级|涉及|升级后，所有的新增资源限制值 UNLIMITED|


# 4. 测试用例

冒烟文本用例：

文本用例：  lsx

# 5. 测试框架设计

使用ha_regress测试框架来进行自动化用例看护

# 6. 测试环境说明

部署：单机HA+集群

# 7. 工作量评估

工作量：12  *人天*

计划测试完成时间：2024/6/7

## Attachments:

## Comments:

|  [](null)  ,1.黑白名单各自不超过64个，指的是非重复ip不超过64个,2.系统表PROFILE$ 不测试,3.数据库mount和unmount连接测试，sys用户连接不校验ip，其他用户报错找不到用户,4.升级测试，补充结果判断(李世铭),  
,  
,Posted by renyanfen at 五月 22, 2024 11:15|
|---|
