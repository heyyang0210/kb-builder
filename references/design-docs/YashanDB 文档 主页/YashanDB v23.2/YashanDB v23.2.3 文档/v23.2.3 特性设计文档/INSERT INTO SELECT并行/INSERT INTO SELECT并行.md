Created by 李燕琼, last modified on 四月 29, 2024

##   [1. 概述](#1-概述)  

insert into select语句中，可以在insert及select关键字后面加hint指定并行度，从而达到并行执行的目的，提升执行效率。

Oracle的insert /  *+ parallel(t1,4)*  / into select默认会开启append，即在高水位线以上插入数据，省去空闲空间查找的时间，经过对比，单append并不能节省多少时间，oracle之所以开启并行后的优化效果显著是因为append +  direct path。

在高水位以上插入数据，因为不推水位线，回滚不需要回滚数据，只要不推水位线就相当于回滚了，也就不需要记录数据页面的undo， 且append模式下都是direct path模式，即不经过buffer， 在内存里组织好一个页面，直接写磁盘，因此在单机模式下，写数据页面也不需要记录redo。

因为不需要记录redo， undo， 省去了大量的时间，插入500万行数据，在普通模式下，耗时56s的， 指定并行后，直接变成2~3s， 且与并行度无关了。

我们本次只实现普通模式下的并行。

DML并行对外是一条语句，即一个事务，数据库内部启动多个线程，事务相关的资源无法共享，需要启动一个父事务，多个子事务，子事务随着主事务一起提交或回滚。

##   [2. Features](#2-features)  

- 提供insert into select语句中select并行的能力


```
insert into t1 select /*+ parallel(t2,4)*/ * from t2 ;

```

- 提供insert into select语句中insert并行能力


```
insert /*+ parallel(t1,4)*/ into t1 select * from t2 ;

```

- 提供insert into select语句中insert， select并行能力


```
insert /*+ parallel(t1,4)*/ into t1 select /*+ parallel(t2,4)*/ * from t2 ;

```

##   [3.Interfaces](#3interfaces)  

##   [4. Limitations](#4-limitations)  

- insert into select并行默认是noappend模式，如果指定了append hint，依然是noappend模式。
- select的并行受限于当前sql引擎支持并行的能力，只支持单表的select并行，具体支持哪些需要sql能通执行计划显示哪些hint是失效的。
- 分布式下不支持并行insert。
- 集群下的并行只能是单实例下的并行。
- 列表的insert into select走的是列执行引擎，目前无法支持并行。
- insert into不支持并行(没有subquery的场景)。


测试关注点：

以下场景是否支持并行insert

1. 带trigger的表
1. 有外键约束的表
1. 临时表


##   [5. Detail Design 详细设计](#5-detail-design-详细设计)  

###   [5.1 语法解析](#51-语法解析)  

parse tree上现在只能记一个并行度，记在CboOptimizer上，在生成物理算子的时候，Table Full Scan等会按照这个并行度生成Cbo算子。

在insert into select语法里， insert和select都可以指定并行度。整个select是一个并行度，insert是一个并行度，可以只指定一个，如果只指定一个并行度，就是多对一，如果两个都指定并行度，取最大的作为整个insert into select的并行度。

需要记录两个并行度，一个dml degree， 一个select degree。

###   [5.2 计划和执行](#52-计划和执行)  

####   [5.2.1 select并行](#521-select并行)  

select并行目前是支持的，只是对接到INSERT语句上没有放开。

1. 放开对于insert into select里select语句hint的解析。
1. 生成logic tree的时候，将CboOptimizer上的degree保留，不要重置成1。


这样在进行transform（逻辑算子转换物理算子）的时候，物理算子会继承CboOptimizer的并行度。进而在做Scan Cbo算子优化的时候，会增加一个OP_PHYSICAL_PX_QUEUE算子。

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d378970c2af4f52112d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFnQUFBQUFBQUFBZ0FBQUFBQUFBSUFBQUFBRUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFDQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2MDYsImV4cCI6MTc4MjMxNzQwNn0.OcKFF5mMfXAN_zXBGCu15z9J7EXukbVmYwjYir1W-U4)

  


####   [5.2.2  insert并行](#522--insert并行)  

demo采用的方法：

在createPlanFromOpTree的最后，针对并行度为N的insert算子，在其上层增加一个 PLAN_PX_COORDINATOR，并创建一个stage，这个stage就是insert, 但是经过实际验证发现，只创建一个stage加到PxDecl->stages是不行的，必须增加PLAN_PX_RECEIVER和PLAN_PX_SENDER，将stage挂到sender上，这样在transform的时候才能识别到这个stage。

修改了execInsert， 发现plan type是PLAN_PX_COORDINATOR，就执行anlExecutePlan，不执行后面的。

增加了fetchInsert函数，发现plan是PLAN_PX_COORDINATOR，就执行anlFetchPlan，通过receiver获取各个子线程是否eof。

建议方案：

Insert算子上层增加一个PARALLEL_DML算子，在PARALLEL_DML算子的并行度是1，但是这个算子 和insert算子之间不需要tab queue， 不需要通过receiver和sender发送数据，且需要专门为dml创建一个stage挂在coordinator上，在启动root stage之前启动dml stage。增加execParallelDml和fetchParallelDml

**execParallelDml**

- 创建父事务，子事务。
- COORDINATOR PAN上不需要root plan。


**fetchParallelDml**

- 轮询查看各个dml stage的子线程有没有结束。


最后依靠closePxCoordinator的时候，汇总各个dml stage 子线程的affect rows。

如果不加PARALLEL_DML，那就修改execInsert函数，对函数的逻辑性有破坏，还需要增加一个fetchInsert函数

**select不指定并行**

insert并行里的select语句，可以独立指定是否并行。

select不指定并行，那就是两个stage，insert stage和select stage，多对一，select的sender规则是random

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d37a1ad9a3311dc8f9e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFnQUFBQUFBQUFBZ0FBQUFBQUFBSUFBQUFBRUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFDQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2MDYsImV4cCI6MTc4MjMxNzQwNn0.OcKFF5mMfXAN_zXBGCu15z9J7EXukbVmYwjYir1W-U4)

  


**select指定并行**

如果select和insert都指定并行，不论并行度是否一样，取最大的作为整体的并行度，insert into select是一个独立的stage。虽然insert和select都是并行的，但是是一一绑定的，所以一组insert和select是一个线程内的，不需要通过receiver和sender发送数据。

![](https://pingcode.yasdb.com/atlas/files/public/67396d378970c2af4f521130/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUVBQUFBQUFnQUFnQUFBQUFBQUFBZ0FBQUFBQUFBSUFBQUFBRUFBQUFFQUFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFDQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2MDYsImV4cCI6MTc4MjMxNzQwNn0.OcKFF5mMfXAN_zXBGCu15z9J7EXukbVmYwjYir1W-U4)

  


这部分有一些优化思路：

1. insert的表如果是分区表，可以给insert和select中间加上一个tab queue，select通过sender，按照part number给receiver发送数据，但是这种可能会造成有些insert线程没活干。
1. 如果insert的表是非分区表，在多对多， 一对多的场景下，select线程可以按照insert的投影列的格式转换后写进物化区，物化区内的数据不加mat row的头，直接按照insert可用的数据格式组装，发送给insert线程的就是一批数据，可以直接对接到存储做批插的一块数据，类似于做批量执行。


本次方案不包括这两个并优化。

###   [5.3 并行事务](#53-并行事务)  

并行insert需要支持父事务子事务，即insert的主线程持有父事务，各个insert子线程持有子事务。

**并行限制**

- 并行语句加的是表的排它锁。
- 有并行语句的事务内，表不能从共享锁升级为排它锁。
    - 对表先做了非并行的dml， insert/delete/update之后，不能再对表进行并行dml。
    - 对表做了并行dml之后，不能再查询表的数据，即不能再执行select/update/delete。
    - 对表做了并行dml之后，可以再次进行insert和insert的并行dml，因为这两个语句不需要读取表数据。


基于以上限制(Oracle的限制)，我们发现，其实父事务和子事务是可以独立提交回滚的，在数据上没有什么依赖关系。

假如说因为一些不可知的bug，导致某个子事务没有跟着父事务一起提交或者回滚，这并不会造成其他数据的错误，相当于一个事务的数据丢失。

注意：noappend模式下，才可以在一个事务内对同一张表多次进行并行dml， 如果是append模式，则只能进行一次并行dml。

YashanDB的限制也是这些，基于上面的原则，父事务和子事务的设计就能简单很多，数据上没有依赖，就可以做到以下几点：

- 子事务是否提交以父事务为准，子事务可以独立回滚， 回滚的顺序不受限制，可以与主事务脱离关系独立回滚。
- 父事务与子事务，子事务与子事务之间不需要数据共享，不需要判断不同事务的数据的可见性(唯一索引冲突需要特殊处理)，即可见性判断上，不需要做特殊处理，当做各自独立的事务。  **父子事务启动**


父子事务都在主线程创建，当执行并行DML的coordinator init时，创建各个子线程需要的子事务，即子Xrm，然后分配给各个子handler。

**父事务与子事务关联**

**Oracle**

普通事务的parent xid是invalid， 在并行事务中，父事务的xid是自己， 子事务的parent xid是父事务。

**YashanDB**

子事务启动的时候，在undo中记录父事务的xid，父事务不需要记录子事务，但是内存里需要记录父事务的所有子事务，当业务发起提交，需要所有的子事务提交日志之后，再进行主事务的提交。用户发起回滚，需要父事务和子事务都回滚之后再返回。

事务内每启动一次并行DML， 都启动一组独立的子事务，挂在主事务Xrm上，便于做语句级回滚和基于savepoint的回滚。Xrm上分配一块内存记录各个子事务的Xid（为了适配未来集群的跨实例并行），设置事务内并行子事务的上限，上限暂定。

####   [5.3.1 事务提交](#531-事务提交)  

**Oracle**

```
父事务
index  state cflags  wrap#    uel         scn            dba            parent-xid    nub     stmt_num    cmt
0x05   10    0x80  0x008d  0x0019  0x0000000000907370  0x00000000   0x000b.005.0000008d  0x00000000   0x00000000  0

子事务
0x0e   10    0xc0  0x0368  0x0002  0x0000000000907370  0x00000000   0x000b.005.0000008d  0x00000000   0x00000000  0
0x1e   10    0xc0  0x0048  0x0062  0x0000000000907370  0x00000000   0x000b.005.0000008d  0x00000000   0x00000000  0
0x0d   10    0xc0  0x0086  0x0040  0x0000000000907370  0x00000000   0x000b.005.0000008d  0x00000000   0x00000000  0

提交后
父事务
0x05    9    0x03  0x008d  0xffff  0x0000000000907955  0x00000000   0x000b.005.0000008d  0x00000000   0x01014216  1714201726

子事务
0x0e    9    0x40  0x0368  0xffff  0x0000000000907955  0x00000000   0x000b.005.0000008d  0x00000000   0x00000000  1714201726
0x1e    9    0x40  0x0048  0xffff  0x0000000000907955  0x00000000   0x000b.005.0000008d  0x00000000   0x00000000  1714201726
0x0d    9    0x40  0x0086  0xffff  0x0000000000907955  0x00000000   0x000b.005.0000008d  0x00000000   0x00000000  1714201726


```

日志

```
-- 子事务2
REDO RECORD - Thread:1 RBA: 0x0014f2.0002734b.0174 LEN: 0x0054 VLD: 0x01 CON_UID: 0
SCN: 0x0000000000907d60 SUBSCN:  2 04/27/2024 15:36:20
CHANGE #1 CON_ID:0 TYP:0 CLS:69 AFN:4 DBA:0x01002b98 OBJ:4294967295 SCN:0x0000000000907d17 SEQ:2 OP:5.12 ENC:0 RBL:0 FLG:0x0000
ktust redo: slt: 22 sqn: 0x00000063 sta: 11 cfl: 0x0

-- 子事务1
REDO RECORD - Thread:1 RBA: 0x0014f2.0002734b.01c8 LEN: 0x0054 VLD: 0x01 CON_UID: 0
SCN: 0x0000000000907d60 SUBSCN:  2 04/27/2024 15:36:20
CHANGE #1 CON_ID:0 TYP:0 CLS:21 AFN:4 DBA:0x010000a0 OBJ:4294967295 SCN:0x0000000000907d17 SEQ:1 OP:5.12 ENC:0 RBL:0 FLG:0x0000
ktust redo: slt: 13 sqn: 0x00000359 sta: 11 cfl: 0x0

-- 父事务
REDO RECORD - Thread:1 RBA: 0x0014f2.0002734d.0010 LEN: 0x007c VLD: 0x05 CON_UID: 0
SCN: 0x0000000000907d64 SUBSCN:  1 04/27/2024 15:36:20
(LWN RBA: 0x0014f2.0002734d.0010 LEN: 0x00000001 NST: 0x0001 SCN: 0x0000000000907d63)
CHANGE #1 CON_ID:0 TYP:0 CLS:33 AFN:4 DBA:0x01000100 OBJ:4294967295 SCN:0x0000000000907d60 SEQ:1 OP:5.4 ENC:0 RBL:0 FLG:0x0000
ktucm redo: slt: 0x0016 sqn: 0x000003b9 srt: 0 sta: 12 flg: 0x0 

-- 子事务2
REDO RECORD - Thread:1 RBA: 0x0014f2.0002734e.0010 LEN: 0x00a0 VLD: 0x05 CON_UID: 0
SCN: 0x0000000000907d66 SUBSCN:  1 04/27/2024 15:36:20
(LWN RBA: 0x0014f2.0002734e.0010 LEN: 0x00000001 NST: 0x0001 SCN: 0x0000000000907d66)
CHANGE #1 CON_ID:0 TYP:0 CLS:69 AFN:4 DBA:0x01002b98 OBJ:4294967295 SCN:0x0000000000907d60 SEQ:1 OP:5.4 ENC:0 RBL:0 FLG:0x0000
ktucm redo: slt: 0x0016 sqn: 0x00000063 srt: 1 sta: 9 flg: 0x3 ktucf redo: uba: 0x01001467.01e9.0f ext: 2 spc: 6464 fbi: 0 
scn:  0x0000000000907d64

-- 子事务1
REDO RECORD - Thread:1 RBA: 0x0014f2.0002734e.00b0 LEN: 0x008c VLD: 0x01 CON_UID: 0
SCN: 0x0000000000907d66 SUBSCN:  1 04/27/2024 15:36:20
CHANGE #1 CON_ID:0 TYP:0 CLS:21 AFN:4 DBA:0x010000a0 OBJ:4294967295 SCN:0x0000000000907d60 SEQ:1 OP:5.4 ENC:0 RBL:0 FLG:0x0000
ktucm redo: slt: 0x000d sqn: 0x00000359 srt: 1 sta: 9 flg: 0x13 ktucf redo: uba: 0x010000a7.01cd.04 ext: 0 spc: 7770 fbi: 0 
scn:  0x0000000000907d64

-- 父事务
REDO RECORD - Thread:1 RBA: 0x0014f2.0002734f.0010 LEN: 0x0088 VLD: 0x05 CON_UID: 0
SCN: 0x0000000000907d68 SUBSCN:  1 04/27/2024 15:36:24
(LWN RBA: 0x0014f2.0002734f.0010 LEN: 0x00000001 NST: 0x0001 SCN: 0x0000000000907d68)
CHANGE #1 CON_ID:0 TYP:0 CLS:33 AFN:4 DBA:0x01000100 OBJ:4294967295 SCN:0x0000000000907d64 SEQ:1 OP:5.12 ENC:0 RBL:0 FLG:0x0000
ktust redo: slt: 22 sqn: 0x000003b9 sta: 9 cfl: 0x0

```

Oracle的提交流程有些不能理解，第一个走到stat 9（提交状态）的是子事务，然后才是父事务，如果改父事务状态之前数据库被KILL， 不明白事务算提交还是回滚。

**YashanDB**  **事务启动:**

- 父事务启动：PXACT_OPEN    --> 通过状态识别事务是否有子事务
- 子事务启动：CXACT_START   --> 通过状态识别这是个子事务


**事务提交：做两阶段提交**

**第一阶段：日志提交**

1. 子事务提交日志：CXACT_COMMIT  --> 当子事务的状态走到了CXACT_COMMIT，子事务的提交状态必须去查看父事务
1. 父事务提交提交日志，预提交：PXACT_COMMIT  --> 确定提交scn，相当于事务走到了in commit状态，此时过来的查询都要等待


**第二阶段：事务提交**

```
先改主事务还是先改子事务状态？
如果先把主事务的状态走到XACT_END，此时主事务的XNODE就可以被复用了，子事务如果还没改，当遇到子事务的XNODE时，需要知道主事务的提交SCN，但是此时已经不知道主事务的提交SCN了。

```

基于这个原因，我们选择先提交子事务，最后再提交父事务，这个流程与分布式事务下的两阶段提交也是类似的。

1. 子事务提交：XACT_END -> 以主事务上的预提交scn作为提交scn。
1. 父事务提交：XACT_END


**提交过程中的查询一致性保证：**

- 如果子事务状态是CXACT_START： 表示事务未提交，不需要去父事务上确认，判定为不可见。
- 如果子事务状态是CXACT_COMMIT：需要去事务上确认事务是否提交
    - 父事务状态是XACT_OPEN：事务未提交
    - 父事务状态是PXACT_COMMIT：需要对比查询scn和事务的预提交scn，
    - 如果查询scn比预提交scn小，则不需要等待，直接判定为不可见
    - 如果大于等于预提交scn，则需要等待当前子事务提交（可以在子事务上等待，也可以在父事务上等待，但是子事务会先设置成提交状态）。


**异常处理**

事务已经预提交，但是事务状态未全部走到提交状态，数据库被KILL，拉起之后，对于已经走到PXACT_COMMIT状态的事务，以及对应的子事务，必须要继续提交。且必须保证先提交子事务，再提交父事务，通过下面的方案来保证：

数据库拉起之后，把所有未提交的事务的状态判一遍。

- 子事务只要走到了CXACT_COMMIT状态，都要判一下父事务状态是否已经走到PXACT_COMMIT。
    - 如果父事务还未走到PXACT_COMMIT状态，就把Xrm挂在rollback list上
    - 如果父事务已经走到PXACT_COMMIT状态，就把Xrm挂到cXrmList上
    - 注意：此时父事务的状态一定不可能是XACT_END状态，因为父事务一定是最后提交的。
- 父事务只要走到已经走到PXACT_COMMIT状态，挂在pCommitList上。
    - 需要一个后台线程去提交这些必须要走到提交状态的事务，且必须从父事务发起。
    - 提交一个父事务，父事务必须去子事务的commitList上，把对应的子事务的全部提交了，最后再把父事务提交了


**集群**

在集群下，要长期维护一个cXrmList，用于保存跨实例的事务，即父事务不在当前实例的Xrm。因为集群下未来可以跨实例并行，因此父事务上需要再引入一个状态PXACT_OPEN状态，如果父事务所在的实例KILL了，拉起之后，回滚父事务，通过PXACT_OPEN就知道是否需要通知其他实例去回滚对应的子事务。

本实例的子事务不需要通知去回滚，因为一定本实例的子事务一定在rollbackList上。

####   [5.3.2 事务回滚](#532-事务回滚)  

**Orale**

```
事务启动后
父事务
index  state cflags  wrap#    uel         scn            dba            parent-xid    nub     stmt_num    cmt
0x18   10    0x80  0x0359  0x0000  0x0000000000906ffd  0x00000000   0x0003.018.00000359  0x00000000   0x00000000  0

子事务
0x20   10    0xc0  0x036d  0x0002  0x0000000000906ffd  0x00000000   0x0003.018.00000359  0x00000000   0x00000000  0
0x0c   10    0xc0  0x008d  0x0019  0x0000000000906ffd  0x00000000   0x0003.018.00000359  0x00000000   0x00000000  0
0x20   10    0xc0  0x0048  0x0062  0x0000000000906ffd  0x0102e4b6   0x0003.018.00000359  0x00000001   0x00000000  0

回滚后
父事务
0x18    9    0x00  0x0359  0xffff  0x000000000090716d  0x00000000   0x0003.018.00000359  0x00000000   0x00000000  1714199881

子事务
0x20    9    0x40  0x036d  0xffff  0x000000000090717c  0x00000000   0x0003.018.00000359  0x00000000   0x00000000  1714199881
0x0c    9    0x40  0x008d  0x0014  0x000000000090717b  0x00000000   0x0003.018.00000359  0x00000000   0x00000000  1714199881
0x20    9    0x40  0x0048  0x0005  0x000000000090717f  0x00000000   0x0003.018.00000359  0x00000000   0x00000000  1714199881


```

日志

```
-- 父事务
REDO RECORD - Thread:1 RBA: 0x0014f3.000000f1.00fc LEN: 0x0058 VLD: 0x01 CON_UID: 0
SCN: 0x0000000000908f2c SUBSCN:  1 04/27/2024 16:44:11
CHANGE #1 CON_ID:0 TYP:0 CLS:101 AFN:4 DBA:0x01006a20 OBJ:4294967295 SCN:0x0000000000908f2b SEQ:1 OP:5.4 ENC:0 RBL:0 FLG:0x0000
ktucm redo: slt: 0x0006 sqn: 0x00000072 srt: 0 sta: 9 flg: 0x4 
rolled back transaction
 
--子事务2
REDO RECORD - Thread:1 RBA: 0x0014f3.000000f4.0010 LEN: 0x0084 VLD: 0x05 CON_UID: 0
SCN: 0x0000000000908f2f SUBSCN:  1 04/27/2024 16:44:11
CHANGE #1 CON_ID:0 TYP:0 CLS:81 AFN:4 DBA:0x01002bf8 OBJ:4294967295 SCN:0x0000000000908f1f SEQ:1 OP:5.4 ENC:0 RBL:0 FLG:0x0000
ktucm redo: slt: 0x0006 sqn: 0x0000007e srt: 0 sta: 9 flg: 0x4 
rolled back transaction

--子事务1
REDO RECORD - Thread:1 RBA: 0x0014f3.000000f5.0010 LEN: 0x0084 VLD: 0x05 CON_UID: 0
SCN: 0x0000000000908f32 SUBSCN:  1 04/27/2024 16:44:11
(LWN RBA: 0x0014f3.000000f5.0010 LEN: 0x00000001 NST: 0x0001 SCN: 0x0000000000908f31)
CHANGE #1 CON_ID:0 TYP:0 CLS:19 AFN:4 DBA:0x01000090 OBJ:4294967295 SCN:0x0000000000908f2f SEQ:1 OP:5.4 ENC:0 RBL:0 FLG:0x0000
ktucm redo: slt: 0x0000 sqn: 0x00000389 srt: 0 sta: 9 flg: 0x4 
rolled back transaction

```

子事务可以独立回滚，一旦父事务回滚，各个子事务就相当于各个独立的事务，独立回滚，独立确定事务结束的scn。

YashanDB

这部分设计与Oracle一致，子事务可以独立回滚，用户主动发起的rollback，也可以并行rollback各个子事务， 本次先做串行的rollback。由主线程回滚各个子事务，最后再回滚父事务，然后客户端返回成功。

如果是重启回滚，则相当于父事务和子事务是各个独立的事务，各自回滚结束后状态设置为XACT_END。

####   [5.3.3 Rollback Savepoint](#533-rollback-savepoint)  

无论是语句失败的语句级回滚还是用户发起的rollback to savepoint，都是基于保存点的回滚。有两种方案来实现。

方案一：

主事务在启动子事务组前记录savepoint， savepoint上记录当前子事务List的位置，如果要回滚savepoint， 就回滚这个点之后的所有子事务。但是担心这种方式在代码内乱用savepoint的场景下，容易像锁区的释放一样，出现各种问题，容易乱。

方案二：

savepoint上记录当前的scn。后续启动的子事务，每个事务的Xrm上记录事务启动的start scn，当语句执行失败(子线程执行失败)，回滚整个语句，只需要将start scn大于savepoint scn的事务回滚。这种方方法需要启动一组子事务的时候，推一下系统的scn。

这个方法同样适用于用户定义的savepoint。

###   [5.4 DFX设计](#54-dfx设计)  

v$transaction的PTX_XID之前的实现有误，应该是子事务的父事务的IXD。

###   [5.5 配置参数](#55-配置参数)  

Oracle要显式enable parallel dml之后，hint里指定的parallel才会生效。

```
alter session enable parallel dml;

```

因为并行DML要加表的排他锁，且并行插入还是append模式，会话默认是disable dml的，因此需要显式打开。

我们本次不支持，hint指定了就可以并行执行，因为这部分还涉及到执行计划的生成和复用，如果session 1生成的是并行的执行计划，session 2又没有enable dml，那执行计划是否能复用。

##   [6. 资料](#6-资料)  

子事务父事务使用户感知不到，用户也无法通过sql语法显示启动一个子事务，是否需要加资料去描述这些细节。

##   [7. 未来规划](#7-未来规划)  

当前父事务和子事务的设计可以支持集群下多实例并行，但是需要并行框架支持集群下的跨实例并行，父事务提交回滚时可以通知其他实例上的子事务及进行提交回滚，可以汇总其他实例上的子线程执行结果。

分布式下的并行目前没有思路。

insert into 不到subquery的并行意义不大，短期内不会做并行。

sqloder可以对接到并行事务上，目前sqloder的各个子线程是自提交的。

  


  


  


  


  


## Attachments: