Created by 林俊喆 on 九月 10, 2024

###   [节点级统计](#节点级统计)  

yashanDB 特有的：

**V$ALLOCATOR**

|字段|意义|
|---|---|
|NAME|名称|
|TOTAL_MEMORY|总内存|
|CURR_MEMORY_USED|近期使用内存|
|FREE_MEMORY|剩余内存|
|MAX_MEMORY_USED|历史最大使用内存|


ORACLE的：

**V$SGA**

SYSTEM GLOBAL AREA 系统全局内存池

|字段|意义|
|---|---|
|NAME|名称|
|BYTES|大小|


统计的内存池包括：

```
NAME                                               SIZE 
--------------------------------- --------------------- 
data buffer                                   268435456
temporary buffer                              134217728
large pool                                     33554432
redo buffer                                     8388608
hot cache                                      16777216
share pool                                    268435456
global application pool                       134217728
dbwr buffer                                     8404992
job pool                                        4194304
parallel execute buffer                       134217728
audit queue buffer                             16777216

```

**V$SGASTAT**

|字段|意义|
|---|---|
|POOL|属于的内存池|
|NAME|字段名|
|BYTES|值|


```
POOL                              NAME                                              BYTES 
--------------------------------- --------------------------------- --------------------- 
SHARE POOL                        sql pool                                       90488688
SHARE POOL                        dictionary cache pool                          40206336
SHARE POOL                        lock pool                                      33554432
SHARE POOL                        cursor pool                                    33554432
SHARE POOL                        free memory                                    50331664
LARGE POOL                        used memory                                           0
LARGE POOL                        free memory                                    33554432

```

**V$SYSSTAT**

|字段|意义|
|---|---|
|STATISTIC#|与V$STATNAME关联可得到统计项的名称|
|NAME|统计项的名称|
|CLASS|统计项的类型|
|VALUE|值|


###   [会话级统计](#会话级统计)  

**V$SESSTAT**

统计每个会话，统计项同    `V$SYSSTAT`  

内存相关统计项

```
NAME
----------------------------------------------------------------
session uga memory
session pga memory
data warehousing scanned blocks - memory
rt prf local disk read memory
IM scan bytes in-memory
IM scan EU bytes in-memory
IM scan CUs column not in memory

```

###   [SQL级统计](#sql级统计)  

**V$SQL**

|字段|意义|
|---|---|
|SHARABLE_MEM|Amount of shared memory used by the child cursor (in bytes)|
|PERSISTENT_MEM|Fixed amount of memory used for the lifetime of the child cursor (in bytes)|
|RUNTIME_MEM|Fixed amount of memory required during the execution of the child cursor|


###   [并行执行相关动态视图](#并行执行相关动态视图)  

**V$PX_SESSION**

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-PX_SESSION.html#GUID-01A67196-4480-4127-808E-A4217B94A0F3](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-PX_SESSION.html#GUID-01A67196-4480-4127-808E-A4217B94A0F3)  

查询并行执行的会话，可与主会话关联

**V$PX_PROCESS_SYSSTAT**

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-PX_PROCESS_SYSSTAT.html#GUID-93A82F35-3201-4DC8-BEF4-23A8B0B4046A](https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/V-PX_PROCESS_SYSSTAT.html#GUID-93A82F35-3201-4DC8-BEF4-23A8B0B4046A)  

并行执行的进程的运行统计，yashanDB无此动态视图

  
