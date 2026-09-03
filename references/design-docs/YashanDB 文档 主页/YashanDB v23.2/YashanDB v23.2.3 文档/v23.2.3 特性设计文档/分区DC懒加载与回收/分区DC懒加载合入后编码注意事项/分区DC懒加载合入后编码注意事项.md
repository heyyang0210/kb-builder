Created by 张锐, last modified on 五月 13, 2024

##   [**后续关于分区dc编码使用注意：**](#后续关于分区dc编码使用注意)  

- 编码时，能使用part上信息的，就使用part上的信息，尽量不要用ssm上的信息（比如取oid可以用part->desc.id，不要使用part->heap->ssm.oid）
- 取segment entry的时候应该先看part handler是否存在，如果存在则取ssm的entry，否则取part的entry（比如取heap entry = part->part == NULL? part->desc.entry : part->heap->ssm.entry）
- 编码时尽量使用分区提供的接口（比如tabGetHandler）
- 编写DDL的时候，需要注意part handler可能不存在，提供    [2种方法处理](https://conf.yasdb.com/pages/viewpage.action?pageId=153004230#ddl%E4%BD%BF%E7%94%A8%E5%88%86%E5%8C%BAdc%E7%9A%84%E5%A4%84%E7%90%86)  
- 节点间同步entry，同步part上的entry，如果part handler也在，ssm也需要同步entry


###   [**懒加载改动：**](#懒加载改动)  

- 所有实体分区的handler（heap、btree、swf、spf等）在open dc的时候不会加载
- pvt dc会加载所有实体分区的handler
- 当需要使用实体分区handler时，会加载一个partNum的所有handler（表，索引，lob）
- nt当作一个独立的表处理


###   [**分区懒加载时机：**](#分区懒加载时机)  

- startCursor的时候
- 分区表插入计算分区号后（ankMapTabPart）
- lob行外插入的时候
- nt插入的时候
- 索引扫描回表时（heap回表和swf回表）
- 一些需要加载实体的ddl


**part entry与ssm上entry：**

当前对于每一个对象分区，有2个entry，一个是part上的entry，一个是ssm上的entry。在dc加载的时候会加载part上的entry，但不会加载实体分区的handler，也就不会加载ssm上的entry。理论上这2个entry应该是一样的，但是由于当前在create entry的时候拿不到part，所以在这个场景下没有给part上同步entry，但是此时这个part一定有handler。

所以，在需要使用entry的地方，  **应该先判断part handler是否存在，如果存在取ssm的entry，如果不存在则取part的entry。**

未来如果做分区dc回收，可以在part handler回收之前，将entry同步到part上。

###   [**集群同步：**](#集群同步)  

分区dc这里集群同步有2种：创建entry同步以及interval分区扩展同步。

- 创建entry同步，找到分区，同步part entry，如果当前part的handler已加载，则同步ssm，否则不同步
- interval分区同步，只加载part，不加载part的handler


###   [**DDL使用分区dc的处理：**](#ddl使用分区dc的处理)  

- 如果使用pvt dc，则不用关心part handler是否加载
- 理论上所有ddl，除非涉及segment，都不需要使用ssm信息，编码时应该能取part上的变量就取part上的变量


如果实在需要使用part handler，则需要先判断是否handler已加载，如果没有加载，有2种办法：

- 加载这个part的所有handler（直接加载到dc，当需要和其他线程公用时，使用这种方法，避免重复不停加载）
- 使用临时加载part handler接口（只是当前ddl临时使用一下，用完就释放。这种应该是大部分场景。 drop和truncate就是使用这种）


当前提供2种临时分区加载使用框架：

- ptTmpEntityAction
- piTmpEntityAction


加载临时实体执行ddl代码框架（以表分区为例）：

```
typedef CodResult (*PtTmpEntityProc)(AnkHandler* handler, TableDict* dc, TabPartDict* tmpPart, CodPointer arg);

static inline CodResult ptLoadEntityTmp(AnkHandler* handler, TableDict* table, TabPartDict* tmpPart)
{
    AnkScn oldScn = handler-&gt;xrm-&gt;dcLoadScn;
    Xid    oldXid = handler-&gt;xrm-&gt;xid;
    handler-&gt;xrm-&gt;xid.value = COD_INVALID_ID64;
    handler-&gt;xrm-&gt;dcLoadScn = ankGetScn(handler);
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