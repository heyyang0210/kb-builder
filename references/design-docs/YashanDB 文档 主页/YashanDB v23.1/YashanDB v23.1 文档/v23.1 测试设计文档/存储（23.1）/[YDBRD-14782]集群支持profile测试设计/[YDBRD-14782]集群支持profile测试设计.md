Created by 高亚宁, last modified on 十一月 09, 2023

# **1. 概述**

本文描述集群支持profile测试设计

# **2. 需求分析**

### **2.1 SR：集群支持profile**

SR:     [YDBRD-14782](https://jira.yasdb.com/browse/YDBRD-14782?src=confmacro)    -  集群支持profile  完成

开发设计：

需求范围：

1. 支持create profile指定password parameter    
  2. 支持drop profile    
  3. 支持alter profile修改profile的限制    
  4. 支持create/alter user指定profile    
  5. 支持create profile, alter profile, drop profile权限

### **2.2 SQL语法**

![](https://pingcode.yasdb.com/atlas/files/public/673969dca1ad9a3311dc796b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUlBQUlCSUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFFQVFBQUFCQUFBQUVBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQWdBQUFBQUFBQUFBQkFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk1NTksImV4cCI6MTc4MjIyMDM1OX0.6pFpY8NBSX-kHRg_kcQNyoFGFtmC2ygFcrWKKCyiZaY)

![](https://pingcode.yasdb.com/atlas/files/public/673969dca1ad9a3311dc796c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUlBQUlCSUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFFQVFBQUFCQUFBQUVBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQWdBQUFBQUFBQUFBQkFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk1NTksImV4cCI6MTc4MjIyMDM1OX0.6pFpY8NBSX-kHRg_kcQNyoFGFtmC2ygFcrWKKCyiZaY)

![](https://pingcode.yasdb.com/atlas/files/public/673969dc8970c2af4f51faf5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUlBQUlCSUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFFQVFBQUFCQUFBQUVBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQWdBQUFBQUFBQUFBQkFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk1NTksImV4cCI6MTc4MjIyMDM1OX0.6pFpY8NBSX-kHRg_kcQNyoFGFtmC2ygFcrWKKCyiZaY)

![](https://pingcode.yasdb.com/atlas/files/public/673969dca1ad9a3311dc796d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiZ0FBQUFBQUFBQUFBQUlBQUlCSUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUlBQUFRQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFFQVFBQUFCQUFBQUVBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBUUFBQWdBQUFBQUFBQUFBQkFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk1NTksImV4cCI6MTc4MjIyMDM1OX0.6pFpY8NBSX-kHRg_kcQNyoFGFtmC2ygFcrWKKCyiZaY)

profile与user关联语法

create/alter user u1 profile profileName

### 2.3 规格——与单机一致

FAILED_LOGIN_ATTEMPTS ，单位为次数，指定取值范围【1，2147483646】，  系统表置2147483647表示(unlimited), 系统表profile$上置为0表示追随default profile. 

PASSWORD_REUSE_MAX同上

PASSWORD_LIFE_TIME(单位为天），系统表里以单位为秒，系统表的范围为【1，2147483646】

PASSWORD_REUSE_TIME, PASSWORD_LOCK_TIME同上

PASSWORD_GRACE_TIME可以取0值，指定为0时，系统表存储-1

# **3. 测试**  **设计方法**   

本需求属于适配类需求，基本功能语法等可复用单机现有设计和用例

针对集群下特有的功能，采用场景法进行设计

### 3.1 测试范围：

1. 磁阵环境，Rac单机部署3实例+分机部署3实例；
1. Rac下，create、alter、drop profile语法及基本功能、权限测试——复用单机现有设计和用例
1. Rac下，  某个实例执行create、alter、drop profile，其他实例能感知到ddl产生的影响及用户密码状态变更——单独设计，写用例看护，重点测试alter
1. 并发/testkill：多实例间create、alter、drop profile并发，与user、密码策略变化等并发
1. 内存、cursor等资源泄漏


### 3.2 专项覆盖

|专项|是否涉及|说明|
|:---|:---|---|
|并发|涉及|  
|
|长稳|涉及|  
|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|DFR/testkill|涉及|  
|
|HA|涉及|暂不支持，后期补测|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|


# 4.   **详细测试设计**   

### 4.1 基本功能、权限测试

在单实例上执行单机现有用例

功能：    [standalone/testcase/storage_object/profile · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/storage_object/profile)  

### 4.2 集群下多实例交互

|  
|测试场景|用例详细描述|预期|备注|
|:---|:---|:---|:---|:---|
|1|create profile|实例1 create，实例2 查询dba_profiles，实例3 创建同名的profile/user/table等|实例1创建成功，实例2能查到，实例3创建报错|  
|
|2|  
|实例1 create，在实例2上校验profile 的6个参数是否生效|在实例2生效|  
|
|3|alter profile|实例1 alter profile的6个参数为default，实例2查询dba_profiles，实例3校验是否生效|实例1修改成功，实例2查询修改值一致，实例3生效|  
|
|4|  
|实例1 alter profile的6个参数为unlimit，实例2查询dba_profiles，实例3校验是否生效|实例1修改成功，实例2查询修改值一致，实例3生效|  
|
|5|  
|实例1 alter profile的6个参数为数值，实例2查询dba_profiles，实例3校验是否生效|实例1修改成功，实例2查询修改值一致，实例3生效|  
|
|6|drop profile|实例1 create，实例2 drop ，实例3查询，再次drop|实例2 drop成功，实例3查询失败，再次drop失败|  
|
|7|并发|多个实例之间并发create、alter、drop profile|数据库不会core|  
|
|8|  
|多个实例并发create、alter、drop profile，结合user，连接yasql|数据库不会core|要触发到密码过期，密码被锁定等场景|
|9|内存泄漏|反复create/alter/drop profile，查询V$DICT_CACHE视图|不会出现内存和cursor泄漏|  
|


# 5.   **测试用例**

[集群支持profile.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGI4OTcwYzJhZjRmNTFmYWVkIiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.mTzXfXTTj5TwmNHB2xi-Movw9BWdXVDACH-4TspqK5o)

# 6.   **测试框架设计**

1. 功能自动化用例添加到yasft/cluster
1. 并发/testkill 用例添加到anchor_test/storage_testcase_cluster


# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[Rac支持表对象及基本DDL.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGJhMWFkOWEzMzExZGM3OTY1IiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.NAsKJ68AaZjQToPti1M7NG0JhOlJV12KJH2JNo3c4oo)

 (application/x-xmind)    


[image2023-4-20_16-8-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGI4OTcwYzJhZjRmNTFmYWVlIiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.zDTw4H1jPbNJtzz07INfxo7eRyHqT_wJlKeR1Uh5SAw)

 (image/png)    


[image2023-4-20_16-7-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGI4OTcwYzJhZjRmNTFmYWVmIiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.Mc3tnYKSwkPQam4ENgrmRNXZSGoLfTlACNLjpeXr3M0)

 (image/png)    


[image2023-4-20_16-7-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGI4OTcwYzJhZjRmNTFmYWYwIiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.OX0N-XXEj4O1XcoPEVTztj1_L3URwiWvPW9GznDOzCg)

 (image/png)    


[表空间透明压缩测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGI4OTcwYzJhZjRmNTFmYWYxIiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.A1cCw0A3hmau__AtRZGKnhOsc98eAcq0_fR4RGO60w0)

 (application/vnd.xmind.workbook)    


[DBWR_IO_MERGE.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGI4OTcwYzJhZjRmNTFmYWYyIiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.bLzMp0KudGEBcVD77_iBWNWt8poN4EaIHfLyidgEIsE)

 (application/vnd.xmind.workbook)    


[image2023-4-12_17-9-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGJhMWFkOWEzMzExZGM3OTY2IiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.2cwucNkhjESuoR0Q1YGuSMdNjPZqq7pfpf4PNNvlTew)

 (image/png)    


[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGJhMWFkOWEzMzExZGM3OTY3IiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.KuJVjz5JEkG1OgbFpZhNqkPn7oGEd0jxoTYYVUTsS48)

 (application/vnd.xmind.workbook)    


[image2023-6-1_17-48-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGJhMWFkOWEzMzExZGM3OTY4IiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.gCnaxaaF9ImQ__WfixYKFaRNHPawD1jEfRL3hHlXsBA)

 (image/png)    


[集群支持profile.xls](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGI4OTcwYzJhZjRmNTFmYWVkIiwicmVmX2lkIjoiNjczOTY5ZGI3MjgyMDZlZmI5MmVmODQ4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NTU5LCJleHAiOjE3ODIyOTU5NTl9.mTzXfXTTj5TwmNHB2xi-Movw9BWdXVDACH-4TspqK5o)

 (application/vnd.ms-excel)    
