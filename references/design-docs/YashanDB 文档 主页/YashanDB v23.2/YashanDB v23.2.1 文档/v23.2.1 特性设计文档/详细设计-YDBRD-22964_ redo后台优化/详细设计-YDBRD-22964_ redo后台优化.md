Created by 朱国旭, last modified on 一月 18, 2024

# **适用场景：IR/SR特性的详细设计文档**

*IR链接：*    [YDBRD-22906](https://jira.yasdb.com/browse/YDBRD-22906?src=confmacro)    *-*  *redo后台任务优化*  *完成*

*SR链接：*    [YDBRD-22964](https://jira.yasdb.com/browse/YDBRD-22964?src=confmacro)    *-*  *redo后台任务优化*  *完成*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#1-%E6%80%BB%E8%BF%B0)  

redo刷盘优化，单个session执行大事务时，产生的redo会积累在内存里，内存满了就触发刷盘，会短暂阻塞前台业务。如果redo内存满之前由后台线程提前把redo刷下去，则不会阻塞前台业务，提高性能。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

1. 需要来源：产品化需求
1. 交付形态：支持单机、集群、分布式


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [特性调研-YDBRD-22964: redo后台优化](/pages/createpage.action?spaceKey=YAS&title=%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94-YDBRD-22964%3A+redo%E5%90%8E%E5%8F%B0%E4%BC%98%E5%8C%96)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|后台异步刷盘，提前刷盘redo，避免阻塞前台业务。|当redo占用超过1M或单个part的占用超过1/3的buffer时，后台触发刷盘。|是|是|
|性能|单个session导入数据，耗时时间同master比较是否有提升|后台提前刷盘redo，避免出现前台业务无法写入redo，等待redo刷盘，影响业务|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#2-%E6%8E%A5%E5%8F%A3)  

新增隐藏参数：  _REDO_FLUSH_THRESHOLD_SIZE用来控制用redo buffer达到多少时触发后台刷盘。

- 默认值：1M
- 范围：【1M，128M】
- 可立即生效


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|V$SYSSTAT|查看字段REDO WRITE SIZE COUNT|该字段表示redo刷盘的大小，我们可以通过这个字段来分析是不是大于1M的刷入|是|
|v$system_event|查看redo buffer慢的等待事件|尽可能保证不出现redo Buffer被占满的情况|是|
|redo_buffer_size|配置redo buffer的大小|配置该参数来验证后台刷盘的触发条件|是|
|redo_buffer_part|可以计算出单个session最多占用的buffer大小|配置该参数来验证后台刷盘的触发条件|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#4-%E7%89%B9%E6%80%A7)  

```
// 为了不影响性能，这里的统计是不加锁的，粗略计算满足条件可以，目标是提前刷盘，避免buffer占满，并不是为了精确刷盘
static CodBool rdNeedFlush(AnkHandler* handler, CodUint64* lfn)
{
    CodUint32 wbid = bufm->wbid;
    CodUint64 size = 0;

    for (CodUint32 i = 0; i < bufm->partCount; i++) {
        CodUint64 dataSize = bufm->parts[i].bufs[wbid].dataSize;
        if (dataSize >= bufm->partSize / 3) {
            // 单个part的空间已经超过1/3了，可以触发刷盘了
            size = COD_INVALID_UINT64;
            break;
        }
        size += dataSize;
    }
    
    *lfn = logm->lfn;
    if (wbid != bufm->wbid) {
        // 这里是不加锁计算的，有可能该buffer已经被刷盘了，统计的值是不对的，所以无需再触发刷盘，需要重新计算
        return COD_FALSE;
    }

    // 所有part的总大小大于1M就可以刷盘了
    return size >= MB(1);
}

static void rdWriterProc(CodThread* thread)
{
    while (!thread->closed) {
        if (!DB_IS_OPEN(handler)) {
            COD_MSLEEP(5);
            continue;
        }

        if (rdNeedFlush(handler, &prevLfn)) {
            rdFlush(handler, prevLfn);
            sleepTime = 1;    // 考虑到环境比较好的机器，不能等待的太久，否则buffer容易被写满，所以这里等待1ms
            timeout = 0; 
            continue;
        }

        if (timeout <= REDO_FLUSH_INTERVAL) {
            timeout += sleepTime;
            continue;
        }

        timeout = 0;  
        sleepTime = 100;  // 为了避免数据库不工作时，该线程尝试你占用cpu，所以需要调整睡眠事件为100Ms
        if (logm->lfn == prevLfn) {
            rdFlush(handler, logm->lfn);
        }

    }
}
```

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

自测用例主要是覆盖单线程插入数据的耗时时间比较，有性能提升即可。

  [redo后台优化测试](https://conf.yasdb.com/pages/viewpage.action?pageId=141578373)  

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

无

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141582070#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

是否需要设置成参数可配？