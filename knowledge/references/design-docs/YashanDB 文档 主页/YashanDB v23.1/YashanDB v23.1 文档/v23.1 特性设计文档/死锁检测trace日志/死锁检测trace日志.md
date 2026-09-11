Created by 张志鹏 on 一月 19, 2024

  


#   [YDBRD-15295 : trace log Design](#ydbrd-15295--trace-log-design)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-15295](https://jira.yasdb.com/browse/YDBRD-15295)  

##   [1. Overview（概述）](#1-overview概述)  

yashandb已实现单机死锁检测，现需要补充死锁检测trace日志，提高定位死锁问题的能力。

##   [2. Features（功能特性）](#2-features功能特性)  

检测到死锁时，dump死锁关系图，各session的信息。

##   [3. Interfaces（接口）](#3-interfaces接口)  

无

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

死锁被检测到时，会打alert日志，指示死锁trace日志路径。    
  trace日志命名规则为，A_yas_B， A为数据库名，B为检测到死锁的会话的session id    
  展示waiter与blocker信息，包括session id， serial    
  资源标识(表锁TM前缀，事务锁与xslot死锁TX前缀）    
  TM-XXXX-XXXX    （XXXX-XXXX为object id即表对象id）    
  TX-XXXX-XXXX   （xext（前两位16进制数）+xnode（中间两位16进制数）+xsn(后四位16进制数)）    
  锁类型(X或S)    
  session登录的user信息    
  session当前执行sql text    
  v$lock查看锁信息、v$session查看serial、v$transaction查看xext、xnode、xsn约束：当前执行sql text长度最大1000字节，超长部分不展示。死锁环最大节点数100，超过只展示100个。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

注册回调函数anrGetDeadLockNodeInfo获取sql session, sql text等信息创建死锁链表，存储死锁的边

typedef struct StDeadLockEdge {DeadLockNode blocker;DeadLockNode waiter;CodChar resName[64];} DeadLockEdge;

typedef struct StDeadLockNode {CodUint32 nodeType;CodUint32 process;CodUint32 session;CodUint32 serial;CodChar holds[64];CodChar waits[64];CodChar        osUser[COD_NAME_BUFFER_SIZE];CodChar        hostName[COD_HOSTNAME_BUFFER_SIZE];CodChar        program[COD_FILENAME_BUFFER_SIZE];CodChar*       currSql;CodUint32      sqlTextLen;} DeadLockNode;

检测到死锁时，遍历backtrace路径，收集死锁环上各节点信息，存入链表。dump到diag/trace目录，命名为ans_yas_%u.trc，%u为发现死锁的session id.

问题：    
  currSql当前直接指向stmt->context->attr->textAddr，是否需要拷贝过来。内存从share pool分

结论：分配一块固定大小2M的内存，死锁检测模块自行内存空间管理

###   [5.4 DFX设计](#54-dfx设计)  

略

###   [5.5 其他](#55-其他)  

略

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

参考    [https://conf.yasdb.com/display/~zhangzhipeng/deadlock+trace](https://conf.yasdb.com/display/~zhangzhipeng/deadlock+trace)  

## Attachments:

[image2023-6-7_18-59-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzQ4OTcwYzJhZjRmNTIwMmIwIiwicmVmX2lkIjoiNjczOTZiMzQ1OTNmOTljOWZmMjM1ZjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTEwLCJleHAiOjE3ODIzNzgzMTB9.hbGikpjhTkM63dfLaOf5gfppKtVcEmvwPSonB_2KvJU)

 (image/png)    


[image2023-6-3_17-48-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzRhMWFkOWEzMzExZGM4MTI1IiwicmVmX2lkIjoiNjczOTZiMzQ1OTNmOTljOWZmMjM1ZjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTEwLCJleHAiOjE3ODIzNzgzMTB9._osft56cIlzktFPATP96EQzyb1fg3dQqe39Tk78sfkA)

 (image/png)    


[image2023-6-3_17-29-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzVhMWFkOWEzMzExZGM4MTI2IiwicmVmX2lkIjoiNjczOTZiMzQ1OTNmOTljOWZmMjM1ZjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTEwLCJleHAiOjE3ODIzNzgzMTB9.7Pc_XZpr06S5GRC5MaIy5Fk64HeLzVQ3_05r7ttU_k8)

 (image/png)    


[image2023-6-3_17-28-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMzU4OTcwYzJhZjRmNTIwMmIyIiwicmVmX2lkIjoiNjczOTZiMzQ1OTNmOTljOWZmMjM1ZjY0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkxOTEwLCJleHAiOjE3ODIzNzgzMTB9.TQVTizC__EvRRfi6IAHQIKQ2kkKCRoDgBlfe95vB3Hw)

 (image/png)    
