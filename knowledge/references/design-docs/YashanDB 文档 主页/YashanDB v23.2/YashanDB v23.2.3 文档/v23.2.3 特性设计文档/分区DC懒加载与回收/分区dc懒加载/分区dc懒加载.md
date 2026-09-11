Created by 张锐, last modified on 六月 05, 2024

IR:    [YDBRD-19732 支持分区DC懒加载](https://pingcode.yasdb.com/pjm/items/66115d3b579a3edb84d6b27d?)  

##   [1. Overview（概述）](#1-overview概述)  

分区表dc加载的时候，只加载list以及desc，不加载实体。实体按需加载。

##   [2. Features（功能特性）](#2-features功能特性)  

- 分区表dc按需加载
- pvt dc全部加载（ddl打开pvt dc后，如果pvt dc也做懒加载，有可能会出现一边修改系统表，一边需要懒加载，此时懒加载可能会出现错误，甚至出现cr访问问题）


##   [3. Interfaces（接口）](#3-interfaces接口)  

无

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

临时表dc？（已确认，没影响。 临时表不支持分区表。ptt自己构造dc，gtt和普通表一样，区别在于加载上来的entry是invalid，从内存里拿entry，与懒加载不冲突）

lobPart把ssm弄成指针，和lobSParts是一个union。 同时lobpart新增oid等元信息。

###   [DC结构修改，按需加载](#dc结构修改按需加载)  

- 依然使用一个mctx
- 分区表dc加载和之前相同，但是不加载实体（heap，swf，btree等）
- 在使用的时候加载一个partNum的所有实体（表，索引，lob）
- ddl过程中，用到哪个实体，临时加载处理，然后释放
- nt也当作表处理


**当前不支持分区回收，在判断entry的时候可以通过part的entry代替handler的ssm的entry，这就要求：**

- 集群同步entry的时候，需要同步的是part上的entry，如果handler已经加载，则同步同步ssm
- 单机创建entry，不会同步修改part的entry（创建entry的时候，只有handler信息）
- 访问entry，先看handler是否存在，存在则取handler的ssm的entry，否则取part的entry


  


###   [分区实体懒加载流程：](#分区实体懒加载流程)  

- 给表分区加锁（集群需要把锁集群化），设置isLoading
- 判断tabPart->part是否为空，如果不为空，说明已经并发加载上来，放锁返回
- 加memLatch
- 设置handler->xrm->dcLoadScn为currentScn，先记录之前的handler->xrm->dcLoadScn
- 分别加载这个表的所有partNum的表分区，索引分区，lob分区的实体到临时变量（如果加载过程中有失败，之前加载出来的实体没有挂到dc上，不会影响，只需要回退mctx的pos）
- 全部加载完成后，一把设置到当前dc上
- 还原handler->xrm->dcLoadScn
- 释放memLatch
- 释放分区load锁


###   [分区DDL流程](#分区ddl流程)  

对于需要使用分区实体的ddl，如果实体未加载，则执行流程如下：

- 加memlatch
- 记录当前mctx的使用位置，MCTX_SAVE_ALLOC_POS(dc->mctx);
- 加载实体到临时变量
- 使用临时变量执行ddl
- 还原当前mctx的使用位置
- 放memlatch


相当于分区ddl即用即放mctx

加载临时实体执行ddl代码框架（以表分区为例）：

```
typedef CodResult (*PtTmpEntityProc)(AnkHandler* handler, TableDict* dc, TabPartDict* tmpPart, CodPointer arg);

static inline CodResult ptLoadEntityTmp(AnkHandler* handler, TableDict* table, TabPartDict* tmpPart)
{
    AnkScn oldScn = handler-&gt;xrm-&gt;dcLoadScn;
    Xid    oldXid = handler-&gt;xrm-&gt;xid;
    handler-&gt;xrm-&gt;xid.value = COD_INVALID_ID64;
    handler-&gt;xrm-&gt;dcLoadScn = ankCurrentScn(handler);
    CodResult res = dcLoadTablePartByType(handler, table-&gt;scn, table, tmpPart);
    handler-&gt;xrm-&gt;dcLoadScn = oldScn;
    handler-&gt;xrm-&gt;xid = oldXid;
    return res;
}

static inline CodResult ptDoTmpEntityAct(AnkHandler* handler, TableDict* dc, TabPartDict* tmp, PtTmpEntityProc proc, CodPointer arg)
{
    if (ptLoadEntityTmp(handler, dc, tmp) != COD_SUCCESS) {
        return COD_ERROR;
    }

    return proc(handler, dc, tmp, arg);
}

CodResult ptTmpEntityAction(AnkHandler* handler, TableDict* dc, TabPartDict* part, PtTmpEntityProc proc, CodPointer arg)
{
    TabPartDict tmpPart = *part;
    dcLatchMemX(handler, dc);
    MCTX_SAVE_ALLOC_POS(dc-&gt;mctx);
    CodResult res = ptDoTmpEntityAct(handler, dc, &amp;tmpPart, proc, arg);
    MCTX_RESTORE_ALLOC_POS(dc-&gt;mctx);
    dcUnlatchMem(dc);
    return res;
}


```

dropSegment加载临时实体执行：

```
static CodResult ptTmpEntityDrop(AnkHandler* handler, TableDict* dc, TabPartDict* tmpPart, CodPointer arg)
{
    return tabDropEntity(handler, dc, tmpPart-&gt;part);
}

CodResult ptDropSegment(AnkCursor* cursor, TableDict* table, TabPartDict* part)
{
    if (part-&gt;desc.isParted) {
        return COD_SUCCESS;
    }

    if (segDelete(cursor, part-&gt;desc.id, part-&gt;desc.dataOid) != COD_SUCCESS) {
        return COD_ERROR;
    }

    AnkHandler* handler = cursor-&gt;attr.handler;
    if (part-&gt;part != NULL) {
        return tabDropEntity(handler, table, part-&gt;part);
    }

    return ptTmpEntityAction(handler, table, part, ptTmpEntityDrop, NULL);
}

```

###   [分区懒加载时机](#分区懒加载时机)  

- startCursor的时候
- 分区表插入计算分区号后（ankMapTabPart）
- lob行外插入的时候
- nt插入的时候
- heapRowIdFetch的时候（此时可能是btree回表）
- 一些需要加载实体的ddl


**在DDL的过程中，什么场景直接懒加载，什么场景加载一个临时的实体使用：**

- 当这个ddl加载的实体可能被其他线程使用时使用懒加载（懒加载直接加载实体到dc上，避免其他线程也需要加载）
- 当这个ddl只是临时自己使用一下实体dc信息时，加载一个临时实体（如果ddl打开的是私有dc，基本上适合这一种）


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

```
create table test(a int) partition by hash(a) partitions 1000 organization tac;
declare
i int;
begin
    for i in 1 .. 1000000 loop
        insert into test values(i);
    end loop;
end;
/
commit;

```

使用上述建表语句以及数据，数据导入完成后，shutdown数据库，重启后drop table。观察dc使用情况：

**懒加载：**

```
 p dc.mctx.blocks
$2 = {head = 0x7f38fbc74be0, tail = 0x7f38fbca0ce8, count = 12,	reserved = 0}
(gdb) p	dc.mctx.currPos
$3 = 10208

```

**不懒加载：**

```
p dc.mctx.blocks
$1 = {head = 0x7f5e3e88ebe0, tail = 0x7f5e3edc4b18, count = 334, reserved = 0}
(gdb) p dc.mctx.currPos
$2 = 8784

```

##   [7. Workload（工作量）](#7-workload工作量)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

##   [9. 未来规划](#9-未来规划)  

分区dc可回收

  


  


## Attachments:

[image2024-4-10_10-9-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjZhMWFkOWEzMzExZGM5MGVlIiwicmVmX2lkIjoiNjczOTZkNjU3MjgyMDZlZmI5MmYxZTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3OTUyLCJleHAiOjE3ODIzOTQzNTJ9.Y3Q0ipAWcSUH8TMjrm7lKyOl_3G9XD2EYtRQcIV1FsA)

 (image/png)    


[image2024-4-10_10-13-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNjY4OTcwYzJhZjRmNTIxMjdkIiwicmVmX2lkIjoiNjczOTZkNjU3MjgyMDZlZmI5MmYxZTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3OTUyLCJleHAiOjE3ODIzOTQzNTJ9.O5d8lN7e79aJBxrwvqy76ztjst7WSON5DDtFpFxT64E)

 (image/png)    
