Created by 李燕琼, last modified on 十一月 28, 2023

##   [1. Overview（概述）](#1-overview概述)  

相同的数据量，相同的环境， insert into select比oracle慢

统计了SQL执行和存储执行的时间发现，90%的时间都在SQL执行阶段，且Yashan的指令数明显高于Oralce。

分析Yashan的火焰图和函数调用堆栈发现，表达式执行的调用栈较深。

其次发现有很多的number类型的decode， encode调用，源表和目标表的number类型完全一致，存储格式是完全兼容的，存在冗余的decode， encode。

##   [2. Feature （功能特性）](#2-feature-功能特性)  

####   [1. 优化column expr](#1-优化column-expr)  

直接从kernel table cursor上取column value，不经过表达式计算

####   [2. number转换优化](#2-number转换优化)  

对于存储格式兼容的number列，不经过CodNumber的中转，直接按照字节处理

##   [3. Interface （接口）](#3-interface-接口)  

无

##   [4. Specification And Constraints （规格与约束）](#4-specification-and-constraints-规格与约束)  

**只能优化源表与目标表是同类型的场景(同为行表，或者同为列表)**

22.2 只支持行表到行表

23.2 支持行表到行表，列表到列表22.2 和23.2都支持行表到行表

两个版本都不支持行表到列表或列表到行表的混合场景23.2 列表到列表是列执行引擎，不属于优化范围

整个plan都不能优化的场景：

**用于优化的内存申请不出来，不优化**

**多表查询不支持优化**  单列不能优化的场景

**只优化kernel column expr**

select sum(xx) from table; -- expr function

select id from table group by xx; -- expr mat column

**lob, udt column**

##   [5. Detail Design （详细设计）](#5-detail-design-详细设计)  

###   [优化点：](#优化点)  

####   [1. 优化column expr](#1-优化column-expr-1)  

从执行execExpr到cursorAttr->getColumnValue()，调用栈太深，中间经过多次判断，以及通过表达式上的信息获取执行态资源，当源表的行数多，目标表的列数多时，这些执行消耗的时间就会变多。

优化思路是在执行前识别出直接从kernel table获取列值的表达式，申请执行态资源，将表达式对应的执行态资源缓存。

在执行阶段，对于提前识别到可以优化的表达式，可以通过table cursor直接获取column value。

####   [2. number转换优化](#2-number转换优化-1)  

number从存储格式转变为CodNumber时，需要decode转换成通用的number格式，CodNumber转换成存储输数据又要经过encode。

当源表和目标表对应列的number类型是互相兼兼容的，decode和encode是可以省略的。

例如源表的列是number(5, 3)

目标表number(5, 2), (4, 3)

```
static CodBool isCompatibleNumber(ColumnAttr* dstAttr, ColumnAttr* srcAttr)
{
    if (dstAttr-&gt;type == DTYPE_NUMBER &amp;&amp; srcAttr-&gt;type == DTYPE_NUMBER) {
        if (dstAttr-&gt;scale &lt; srcAttr-&gt;scale) {
            return COD_FALSE;
        }
        if (dstAttr-&gt;precision - dstAttr-&gt;scale &lt; srcAttr-&gt;precision - srcAttr-&gt;scale) {
            return COD_FALSE;
        }
        return COD_TRUE;
    }
    return COD_FALSE;
}

```

###   [5.1 Compatibility （兼容性）](#51-compatibility-兼容性)  

不涉及，纯内存优化，不涉及兼容性问题

###   [5.2 DFX设计](#52-dfx设计)  

不涉及

##   [6. Testcase （自测用例）](#6-testcase-自测用例)  

##   [7. 资料设计章节](#7-资料设计章节)  

不涉及

##   [8. TODO (遗留问题)](#8-todo-遗留问题)  

## Attachments:

[insert_select.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGVhMWFkOWEzMzExZGM4NzY4IiwicmVmX2lkIjoiNjczOTZjMGU3MjgyMDZlZmI5MmYwZDEyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4ODcwLCJleHAiOjE3ODIzODUyNzB9.sxz9Jn2bpxhuXio2GQqw8VejWtzJFdXixeJpjZHFRGA)

 (application/octet-stream)    
