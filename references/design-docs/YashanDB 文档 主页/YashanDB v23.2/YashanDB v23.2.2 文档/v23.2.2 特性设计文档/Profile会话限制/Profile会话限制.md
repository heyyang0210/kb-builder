Created by 张志鹏, last modified on 四月 25, 2024

  


#   [YDBRD-29796: profile 会话策略Design](#ydbrd-29796-profile-会话策略design)  

IR链接：YDBRD-28097 / SR链接：    [https://jira.yasdb.com/browse/YDBRD-29796](https://jira.yasdb.com/browse/YDBRD-29796)  

##   [1. Overview（概述）](#1-overview概述)  

profile支持IDLE_TIME和SESSIONS_PER_USER功能项IDLE_TIME 允许空闲会话的时间，单位是分钟，默认无限制SESSIONS_PER_USER 每个用户名所允许的并行会话数，默认无限制

需求范围：单机和集群

##   [2. Features（功能特性）](#2-features功能特性)  

支持profile配置参数sessions_per_user, idle_time；限制用户连接的最大并行会话数，与用户空闲无操作的时间限制

##   [3. Interfaces（接口）](#3-interfaces接口)  

```
create profile：
= CREATE PROFILE profile_name LIMIT [kernel_parameters].

resource_parameters:
= resource_parameter_name resource_parameter_value
  {" " resource_parameter_name resource_parameter_value}.


```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

1. sessions_per_user限制一个用户可以同时发起的会话上限，配置值为[1, 2147483646]的整数
1. 该需求的目的是限制用户对会话资源的滥用，sys用户为超级管理员用户，不受对应约束。（和oracle一致）
1. 集群下session_per_user限制为用户实例级，每个用户在每个实例下的会话上限都为配置值，互相独立。
1. idle_time限制用户会话最长的空闲无操作时间，服务端将巡检如果某个会话超过限制时间无操作，将会断开该链接释放会话资源。idle_time配置值单位为分钟，取值为[1, 2147483646]的整数值。
1. 服务端巡检会话超时目前设计是10s巡检一次，所以配置的空闲无操作时间被杀会话有10s的最大误差，oracle的巡检间隔不太确定，大致也是几秒。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

profile相关DDL提供了创建配置项，关联用户与配置项的能力。在该基础能力上添加两个配置项sessions_per_user, idle_time，具体含义见功能特性。

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [5.2.1](#521)  

新增profile资源，需要适配升级场景。    
  升级脚本中插入新增资源，且将所有profile的新增资源限制值设为默认值，通过alter profile 历史profile limit xxx完成。

####   [5.2.2](#522)  

UserDict添加sessions字段表示当前用户连接会话数。    
  ankHandler->attr添加isUserConn字段标识为用户登录，而非后台线程/job    
  登录成功sessions++， logout sessions--，ankLogout处如果isUserConn为true，session--。需要适配登录接口，后台线程/分布式内部连接会话不计数。

1. anrLoginDigest
1. anrLoginOs


![](https://pingcode.yasdb.com/atlas/files/public/67396cc48970c2af4f520e39/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDMzMTEsImV4cCI6MTc4MjMxNDExMX0.JTcpTN6XzFg7TuPfN_vNQW_3omZjdwH0P1YWBomSwpw)

####   [5.2.3](#523)  

会话Session添加isActive字段，新会话该字段初始化为false。当会话开始处理请求， isActive置为true, 处理完成置为false，并登记当前处理完成时间（最后一次活跃时间）。    
  会话空闲超时，由后台smon线程每隔十秒巡检一次，发现会话距离最后一次活跃时间超过阈值，断开该会话。因为巡检时间为10s，所以超时断开有10s左右的误差，测试需要注意。

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

升级场景，profile新增配置项，旧版本升级需要添加default profile该配置项。

###   [5.4 DFX设计](#54-dfx设计)  

dba_profiles视图适配，oracle的资源限制分为密码类和kernel类，sessions_per_user与idle_time都是kernel类的。    
  用户会话数量oracle没找到对应字段，可select count(*) from v$sessions where username = 'XXX'查询;

###   [5.5 其他](#55-其他)  

无新增sql语法，审计，权限不涉及。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
#encoding: utf-8
import sys, os, time
import threading
import subprocess
sys.path.append("../scripts")
import ha_node as node
import ha_helper as ha

threads = []
N1, N2, N3 = node.DataBaseNodes()
def loginProc(user_passowrd, sessions):
    sess = N1.createSession(user_passowrd)
    sessions.append(sess)

def multiLogin(user_passowrd, sessionCnt, sessions):
    for _ in range(sessionCnt):
        t = threading.Thread(target=loginProc, args=(user_passowrd, sessions))
        threads.append(t)
        t.start()
    for t in threads:
        t.join()

def logoutAll(sessions):
    for sess in sessions:
        N1.exitSession(sess)


N1.run("grant connect to public")

# TEST sessions_per_user 3
N1.run("drop user test_session_u1")
N1.run("drop profile p1 cascade")
N1.run("create profile p1 limit sessions_per_user 3")
N1.run("select * from dba_profiles where profile = 'P1' order by 2")
N1.run("select limit from dba_profiles where profile = 'P1' and RESOURCE_NAME = 'SESSIONS_PER_USER'").expect('3')
N1.run("create user test_session_u1 identified by 123 profile p1")
sessions = []
multiLogin("test_session_u1/123", 3, sessions)
N1.run("select count(*) from v\$session where username = upper('test_session_u1')").expect("3")
sess = N1.createSession("test_session_u1/123")              # failed to create session
N1.runS(sess, "select count(*) from dual").expect("please input password")  # Text"please input password" means reconnectting, which can be inferred that create session failed

## previous 3 sessions connectting
for s in sessions:
    N1.runS(s, "select count(*) from dual").expect("fetched")

## logout one session, and create a new session of test_session_u1
N1.exitSession(sessions[0])
sess = N1.createSession("test_session_u1/123")   
N1.runS(sess, "select count(*) from dual").expect("fetched")
sessions[0] = sess

# TEST sessions_per_user 10

# TEST sessions_per_user default
N1.run("alter profile p1 limit sessions_per_user default").expect("Succeed")
## expect succeed
multiLogin("test_session_u1/123", 2, sessions);
N1.runS(sessions[3], "select count(*) from dual").expect("fetched")
N1.runS(sessions[4], "select count(*) from dual").expect("fetched")

N1.run("alter profile default limit sessions_per_user 5").expect("Succeed")
sess = N1.createSession("test_session_u1/123")   
N1.runS(sess, "select count(*) from dual").expect("please input password")

## test sys multiLogin, expect unlimited
sysSessions = []
multiLogin("sys/Cod-2022", 200, sysSessions)
for sess in sysSessions:
    N1.runS(sess, "select count(*) from dual").expect("fetched")
logoutAll(sysSessions)

## restore default profile
N1.run("alter profile default limit sessions_per_user unlimited").expect("Succeed")
logoutAll(sessions)
# TEST sessions_per_user unlimited




# TEST IDLE_TIME
test_case1 = [(70, True)]
test_case2 = [(50, False), (20, False), (70, True)]
def checkIdle(session, time_case):
    for time_info in time_case:
        seconds, isIdle = time_info
        time.sleep(seconds)
        if isIdle: 
            N1.runS(session, "select count(*) from dual").expect("connection is closed")
        else:
            N1.runS(session, "select count(*) from dual").expect("fetched")    
    
def testIdle(session, time_case):
        thread = threading.Thread(target=checkIdle, args=(session, time_case))
        thread.start()
        return thread

## idle_time 1
N1.run("drop user user_idle_time")
N1.run("drop profile p2 cascade")
N1.run("create profile p2 limit sessions_per_user unlimited idle_time 1")
N1.run("select limit from dba_profiles where profile = 'P2' and RESOURCE_NAME = 'SESSIONS_PER_USER'").expect('UNLIMITED')
N1.run("select limit from dba_profiles where profile = 'P2' and RESOURCE_NAME = 'IDLE_TIME'").expect('1')
N1.run("create user user_idle_time identified by 123 profile p2")
idle_sessions = []
### login
multiLogin("user_idle_time/123", 4, idle_sessions)

### change idle_time limit for user_idle_time, expect no impact on connected sessions(whose idle_time are 1 min)
N1.run("alter profile p2 limit idle_time 2").expect("Succeed")
N1.run("select limit from dba_profiles where profile = 'P2' and RESOURCE_NAME = 'IDLE_TIME'").expect('2')
### BackGround testing idle_time with different cases
test_thread1 = testIdle(idle_sessions[0], test_case1)
test_thread2 = testIdle(idle_sessions[1], test_case2)
print("Continue Other Test\n")

### reconnect and idle_time limit is 2min
N1.runS(idle_sessions[2], "conn user_idle_time/123@127.0.0.1:1601").expect("Connected to")
test_case3 = [(70, False), (130, True)]
test_thread3 = testIdle(idle_sessions[2], test_case3)

test_thread1.join()
test_thread2.join()
test_thread3.join()
N1.run("revoke connect from public")


```

##   [7.资料设计章节](#7资料设计章节)  

create profile, alter profile文档添加新增的资源项目    
    [https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20PROFILE.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20PROFILE.html)      
    [https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20PROFILE.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20PROFILE.html)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

略

## Attachments:

[Snipaste_2024-04-02_11-22-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzQ4OTcwYzJhZjRmNTIwZTM4IiwicmVmX2lkIjoiNjczOTZjYzQ1OTNmOTljOWZmMjM3MmJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMzExLCJleHAiOjE3ODIzODk3MTF9.9hKbUrNpiwolPgwRRiwtFbmVWbIrCiqvkTpktAe8UdI)

 (image/png)    


[image2024-4-1_15-45-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzRhMWFkOWEzMzExZGM4Y2FiIiwicmVmX2lkIjoiNjczOTZjYzQ1OTNmOTljOWZmMjM3MmJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMzExLCJleHAiOjE3ODIzODk3MTF9.NNVaWWCCAqxN-7bx0ft-aFuNOhWyt2okJS_olNTaQ7I)

 (image/png)    


[image2024-4-1_15-12-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjYzRhMWFkOWEzMzExZGM4Y2FjIiwicmVmX2lkIjoiNjczOTZjYzQ1OTNmOTljOWZmMjM3MmJmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzMzExLCJleHAiOjE3ODIzODk3MTF9.ZxwWWnfUAh9lRqY7SMjOl426Dheu4zox1qvvjOVuyVU)

 (image/png)    


## Comments:

|  [](null)  ,开发设计评审会议纪要：    
  参会人：张志鹏，李燕琼，易文亮，高亚宁,1. 对外文档/开发文档添加alter profile语法变更
1. idle_time限制是否支持小数
1. oracle添加告警事件
1. incident事件
,Posted by zhangzhipeng at 四月 09, 2024 15:37|
|---|
|  [](null)  ,2. 结论： 不支持小数,4. 不新增incident事件，仅增加告警日志,Posted by zhangzhipeng at 四月 25, 2024 14:40|
