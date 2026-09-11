Created by 张志鹏, last modified on 七月 09, 2024

  


#   [YDBRD-26538](#ydbrd-26538)  

IR链接：    [https://pingcode.yasdb.com/ship/ideas/660b7481009f91eb87f2bfbe](https://pingcode.yasdb.com/ship/ideas/660b7481009f91eb87f2bfbe)  

SR链接：    [https://pingcode.yasdb.com/pjm/items/YDBRD-26343](https://pingcode.yasdb.com/pjm/items/YDBRD-26343)  

##   [1. Overview（概述）](#1-overview概述)  

profile支持用户失败登录间隔    
  需求范围：单机，集群分布式

##   [2. Features（功能特性）](#2-features功能特性)  

支持profile配置参数failed_login_interval，该参数决定了用户因密码错误登录失败后，到下一次登录尝试需要的时间间隔。    
  与现有failed_login_attempts, password_lock_time并行。当用户密码错误失败登录后，需要等待interval时间后再尝试，这段时间内，用户处于lock（interval）状态，登录报错the account is locked。

##   [3. Interfaces（接口）](#3-interfaces接口)  

| 策略参数          | 参数值规则                                                   |    
  |FAILED_LOGIN_INTERVAL | 用户失败登录间隔，单位为秒，取值需为整数，取值范围（0,2147483647）。       |    
  failed_login_interval属于password_parameters分类

create profile/alter profiel语法参照

  [https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/DROP%20PROFILE.html](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/DROP%20PROFILE.html)  

  [https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20PROFILE.html](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20PROFILE.html)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1.dev上不支持分布式profile，回合master后天然支持此功能，回合后补测。2.分布式下, 用户连续密码错误计数，超过阈值锁定都是用户实例级。failed_login_interval也一样。即在一个实例上错误登录后，在该实例上需要间隔failed_login_interval时间后才能再次登录。其他实例不受影响。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

profile相关DDL提供了创建配置项，关联用户与配置项的能力。在该基础能力上添加failed_login_interval配置项。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1](#521)  

新增profile资源，需要适配升级场景。    
  升级脚本中插入新增资源，且将所有profile的新增资源限制值设为默认值，通过alter profile 历史profile limit xxx完成。

####   [5.2.2](#522)  

如果failed_login_attempts刚好也是1，即连续失败一次，按照规则需要锁定password_lock_time时间。因为failed_login_interval为10s,则实际锁定时间为MAX(password_lock_time, failed_login_interval).

**编码:**

####   [5.2.4 系统表，系统视图](#524-系统表系统视图)  

- DBA_USERS可以查看用户状态，密码错误后，在登录间隔内，用户被锁定，对应状态为lock（interval）。


###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

升级场景，profile新增配置项，旧版本升级需要添加default profile该配置项。

###   [5.4 DFX设计](#54-dfx设计)  

###   [5.5 其他](#55-其他)  

无新增sql语法，审计，权限不涉及。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

create profile p1 limit failed_login_interval 10; -- 失败后间隔10s才能再次登录    
  create user u1 identified by u1 profile p1;       -- u1配置文件为p1    
  conn     [u1/xxx@127.0.0.1](mailto:u1/xxx@127.0.0.1)    :1688  --failed    
  -- in 10s    
  conn     [u1/u1@127.0.0.1](mailto:u1/u1@127.0.0.1)    :1688   --failed, error: the account is locked    
  conn sys/Cod-2022    
  select ACCOUNT_STATUS from dba_users where username = 'U1'; --expect locked(interval)    
  -- 10s later    
  conn     [u1/u1@127.0.0.1](mailto:u1/u1@127.0.0.1)    :1688   --succeed

##   [7.资料设计章节](#7资料设计章节)  

create profile, alter profile文档添加新增的资源项目

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

略

## Attachments:

[image2024-5-16_11-35-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTI4OTcwYzJhZjRmNTIxOWU3IiwicmVmX2lkIjoiNjczOTZlYTI1OTNmOTljOWZmMjM4NmZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NTQwLCJleHAiOjE3ODI1MjQ5NDB9.qJN8-E_7xPjrFrlHZgr_Wrm1r0q3F1okHmsDMbtZE74)

 (image/png)    


[image2024-5-14_11-41-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTI4OTcwYzJhZjRmNTIxOWU4IiwicmVmX2lkIjoiNjczOTZlYTI1OTNmOTljOWZmMjM4NmZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NTQwLCJleHAiOjE3ODI1MjQ5NDB9.VQzjgqbiwYEMgzGOSNUxZGbmM0-wZm9_7PspCraAdPs)

 (image/png)    


[image2024-5-14_10-46-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTJhMWFkOWEzMzExZGM5ODVkIiwicmVmX2lkIjoiNjczOTZlYTI1OTNmOTljOWZmMjM4NmZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NTQwLCJleHAiOjE3ODI1MjQ5NDB9.cPrjeR0-3PIXI_mstfNRIxaavz8vhi5ZB3jO8_ALjf4)

 (image/png)    


[image2024-5-14_10-18-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTI4OTcwYzJhZjRmNTIxOWU5IiwicmVmX2lkIjoiNjczOTZlYTI1OTNmOTljOWZmMjM4NmZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NTQwLCJleHAiOjE3ODI1MjQ5NDB9.i-v8yoni4scQJ1N7qaH_2ubxyrZio5tbsq64F2n9sTA)

 (image/png)    


[image2024-5-14_10-18-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTJhMWFkOWEzMzExZGM5ODVlIiwicmVmX2lkIjoiNjczOTZlYTI1OTNmOTljOWZmMjM4NmZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NTQwLCJleHAiOjE3ODI1MjQ5NDB9.MPCAtZ2ajUH8TOCrvHr4RQNtlbL5wMR8umTbRu0cEwc)

 (image/png)    


[image2024-5-14_10-18-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTM4OTcwYzJhZjRmNTIxOWVhIiwicmVmX2lkIjoiNjczOTZlYTI1OTNmOTljOWZmMjM4NmZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NTQwLCJleHAiOjE3ODI1MjQ5NDB9.LVWWuI_blpwgoLeya9bX-fP-HKPcwxqT6Z8aIn4WSdY)

 (image/png)    


## Comments:

|  [](null)  ,2024.7.9评审会议纪要,参与人:  高亚宁，李燕琼，马爽，张志鹏。,1. failed_login_interval锁定报错提示，请N秒后再重试。
1. ha相关的约束说明一下，和已有密码相关策略 一致
1. 当前dev不支持分布式，拆sr回合master后补测。
,Posted by zhangzhipeng at 七月 09, 2024 10:25|
|---|
