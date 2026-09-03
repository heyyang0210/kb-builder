Created by 郝鑫刚, last modified on 四月 23, 2024

  


IR:     [YDBRD-20843](https://jira.yasdb.com/browse/YDBRD-20843?src=confmacro)    -  23.2 UDT能力补齐  完成

SR:     [YDBRD-22986](https://jira.yasdb.com/browse/YDBRD-22986?src=confmacro)    -  UDT支持物化算子  完成

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

物化算子用于完成结果集再次加工进行排序、去重等算法能力，用于支撑hash join/merge join/distinct/group by/order by等功能实现。

实现上可理解为一个虚拟内存，执行distinct、group by、order by这些相关sql时，结果会先在物化区进行处理之后再输出到客户端。

  


当前代码，包含UDT列在做排序、去重等动作时，会报错UDT物化不支持。导致SQL不能查询。该需求是实现UDT的物化算子能力，支持UDT类型在  **值区域**  时（UDT类型只出现在投影列区域，不参与排序、去重动作本身）的排序、去重等操作。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9e8970c2af4f520d56/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

可测试点：

1. 直接查询UDT列且带ORDER BY等功能用例  **查询报错变化**  ，从物化不支持变为查询不支持。
1. "selection column of UDT"的SQL可以在过程体内通过INTO给变量查询结果是否正确。（一些语法不支持的这次也做支持。比如fetch游标里有UDT列）
1. 覆盖UDT的各种嵌套关系，已经嵌套后底层关键标量类型（number、lob、nchar等）覆盖。
1. ~~改动包含计划的重新调整后，依然可以执行。（一个例子：udf入参是UDT返回值是标量）~~


  


  


支持的场景：

ORDER BY.

select * from udt_t1 order by 1; --SORT

select * from udt_t1 order by 1 limit 1;  --TOP SORT

CONNECT BY:

select * from udt_t1 connect by C1 < 50;

集合操作：

select * from udt_t1 UNION/INTERSECT/INTERSECT ALL/MINUS/MINUS ALL select * from udt_t1;

JOIN:

select * from udt_t1 t1 INNER JOIN udt_t2 t2 on t1.c2 = t2.c2;    --HASH JOIN

select * from udt_t1 t1,udt_t2 t2 where t1.c2 = t2.c2;  --等价上面的INNER JOIN

select * from udt_t1 t1,udt_t2 t2 where t1.c2 > t2.c2;  --MERGE SORT

select * from udt_t1 t1 LEFT/RIGHT/FULL OUTER JOIN udt_t2 t2 on t1.c2 = t2.c2;

  


  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396c9e8970c2af4f520d57/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

```
set serverout on

create type udt_object as object (a1 int, a2 number, a3 varchar(64));
/
create table udt_t1 (c1 int, c2 number, c3 udt_object);
insert into udt_t1 values(3, 3452.69, udt_object(3123, 3258.41, 'nihyfj3'));
insert into udt_t1 values(1, 452.69, udt_object(123, 258.41, 'nihyfj'));
commit;

-- 直接查询报错
select * from udt_t1 order by c1;

-- 带order by和不带order by结果的顺序不一样
begin
	FOR v_sal IN (select * from udt_t1) LOOP
		DBMS_OUTPUT.PUT_LINE(v_sal.c1||'---'|| v_sal.c3.a2 || v_sal.c3.a3) ;
	END LOOP;
end;
/

begin
	FOR v_sal IN (select * from udt_t1 order by c1) LOOP
		DBMS_OUTPUT.PUT_LINE(v_sal.c1||'---'|| v_sal.c3.a2 || v_sal.c3.a3) ;
	END LOOP;
end;
/

-- 使用cursor查询
declare
	type udt_ot1record is record (c1 int, c2 number, c3 udt_object);
	vr1 udt_ot1record;
	cursor vc1 is select * from udt_t1 order by c1;
begin
	open vc1;
	for i in 1 .. 2  loop
		fetch vc1 into vr1;
		DBMS_OUTPUT.PUT_LINE(vr1.c1||'---'|| vr1.c3.a2 || vr1.c3.a3) ;
	end loop;
	close vc1;
end;
/
```

  


###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

开发需求。

支持单机、集群、分布式部署。不支持列存场景。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|兼容性|----|----|否|否|
|功能|序列化|按格式把UDT的结构化数据转成字节流|是|是|
|功能|反序列化|把字节流按格式转成结构化数据|是|是|
|功能|表列、udf返回值|物化框架已覆盖，天然支持。|否|是|
|可修改性|----|----|否|否|
|可用性|恢复场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|可靠性|故障场景|----|否|否|
|周边配合|权限|----|----|否|
|周边配合|审计|----|----|否|
|周边配合|导入导出工具|----|----|否|
|安全|安全场景1|----|否|否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|
|易用性|----|----|否|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|UDT|自定义数据类型|无|参考技术设计链接|
|  
|  
|  
|  
|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|函数,  `aniUdtSerialize()`  |  `v：UDT数据的内存结构。`  ,  `buf：是序列化用的内存。`  ,  `maxSize：内存的最大值。`  ,  `initProcs：序列化过程中对数据v的处理函数。`  ,type：数据v的数据类型。,srlzLen：返回值。序列化后的长度。|实现从UDT内存结构到字节流的序列化。|是|
|函数,  `aniUdtDeserialize()`  |  `bytes：UDT数据格式化后的字节流。`  ,  `owner：反序列化中数据v的内存来源。`  ,  `initProcs：反序列中数据v的处理函数。`  ,  `v：是反序列化后的数据。`  |实现从UDT的字节流到内存结构的反序列化。|是|
|错误码|  
|  
|  
|


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

规格：

- 不支持VARRAY/TABLE类型直接参与ORDER BY 、DISTINCT、GROUP BY等操作。
- OBJECT类型有LOB时不支持直接的ORDER BY等操作。
- CONNECT BY、聚集函数等场景种不能有UDT。


  


约束：

- 由于协议未实现，直接查询UDT类型还是会报错。
- 不支持列存和临时UDT数据（string_to_array()）。
- 没有LOB列时需要有MAP或ORDER方法(还有实现的限制：DISTINCT不支持OBJECT，GROUP BY、ORDER BY后的OBJECT需有MAP方法)。
- 物化的整体大小是63k，包含UDT列后，整体超过这个值也会报错。
- GROUP BY时候，查询列里不能有UDT。


  


  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

物化区实现上有2部分，把数据放入物化区（gMatVariantCompactPuts），从物化区取数据（execMatColumnExpr）。

物化区中存放的都是二进制数据，该需求主要实现UDT的Variant结构到二进制数据的序列化和反序列化。（期望该序列化过程与协议、C驱动通用，所以实现上把UDT序列化格式和数据操作拆分，服务端物化实现一套Variant结构的操作函数。）

  


  


### 4.1 序列化详细设计

#### 4.1.1 序列化流程

实现matPutObject、matPutVarray、matPutTable接口。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9ea1ad9a3311dc8bc9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

```
typedef struct StUdtSrlzHead {
    CodUint8 type;       // 说明当前data的数据类型。DataType类型
    CodUint8 version;    // 协议版本检测。A1。 
    CodUint8  data[6];
} UdtMatHead;



typedef struct StCsUdtSrlzrCtx {
    CsUdtSrlzrProc*     procs;
    AniUdtSrlzPrepare   prepareSrlz;
    CodUint8*   buf;		//序列化使用的内存
    CodUint32   maxLen;		//序列化内存最大值
    CodUint32   offset;		//已序列化字节流长度。
    CodUint8    convBuf[UDT_MAT_SRLZ_TMP_BUF_LEN];	//NUMBER、LOB类型转换的临时内存。
} CsUdtSrlzrCtx;

typedef struct StCsUdtDesrlzrCtx {
    CsUdtDesrlzrProc* procs;
    CodPointer  memOwner;//反序列化中的资源来源。
    CodPointer  superUdt;//用例获取子类型的UdtDict结构
    CodUint8*   data;	//反序列化的字节流。
    CodUint32   size;   //反序列化字节流的长度。
    CodUint32   offset; //已反序列化的位置。
} CsUdtDesrlzrCtx;
```

#### 4.1.2 序列化的详细格式：

4.1.2.1 基础的序列化格式。

先放len再放data。len的具体长度和值根据第一个字节来判断。len的值表示data的长度。（不包括len本身）

len value <= 0xFA then  value表示size, 长度1字节。

len value = 0xFB then value只是flag, value后两字节为长度。

len value = 0xFC then value只是flag, value后四字节为长度。

len value = 0xFF表示是NULL。

由于UDT序列化时都有head，所以len的位置不会是NULL，NULL的具体格式在后面说明。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9e8970c2af4f520d59/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

4.1.2.2 标量的序列化

标量data部分的格式是HEAD+数据流。序列化时len是head+数据流的长度。

number使用codEncodeNumber()转换成CodBytes，其它类型使用varDetach()转换。反序列化时使用varAttach()。

lob类型：LOB_KNL_COUPON转换成LOB_KNL_LOCATOR。其它情况直接varDetach()。  ~~head→hasLob标记UDT序列化中包含了LOB类型~~

标量序列化流程：

1. 获取标量数据的字节流。
1. 序列化len字段。值是字节流长度+head长度
1. 设置head。
1. 序列化标量数据的字节流。


  


![](https://pingcode.yasdb.com/atlas/files/public/67396c9e8970c2af4f520d5a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

备注：head占6个字节，标量NULL值比较常见，且可能本身数据都比6字节少，故去掉标量中的head字段。

  


序列化中需要的临时内存：

序列化前提前申请系统栈内存，用全局指针指向该内存，序列化过程中通过指针使用上层函数的栈内存。

  


  


4.1.2.3 OBJECT的序列化

格式：HEAD+TOID+属性个数+n个属性。

说明：TOID和属性个数都是一个标准的序列化单元。每个属性格式也是一个标准的序列化单元，data部分对应的是标量的格式。

lob属性：行内存储时进行浅拷贝。KNL_COUPON时转换成LOB_KNL_LOCATOR。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9fa1ad9a3311dc8bca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

  


4.1.2.4 VARRAY/TABLE的序列化

格式：HEAD+TOID+元素个数+n个元素。

说明：TOID、元素个数、都是一个标准的序列化单元。每个元素格式也是一个标准的序列化单元，data部分对应的是标量的格式。

去掉元素最大数：发现不需要，反序列化时通过TOID可以找到该属性。

LOB元素: TABLE列中行外的LOB数据在会转成LOB_KNL_LOCATOR，而VARRAY列不能有LOB类型。  所以这里只做浅拷贝。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9fa1ad9a3311dc8bcb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

4.1.2.5 UDT嵌套的序列化

属性或元素部分内容的data为UDT的序列化格式。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9fa1ad9a3311dc8bcc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

嵌套UDT的序列化流程：

1. 先把buf移动5个字节。（认为嵌套的udt成员数据长度是0xFC格式的）。
1. 使用当前buf，maxLen-offset初始化subSrlzr。
1. 使用subSrlzr序列化UDT成员。此时UDT成员序列化后的data就在正确的内存上，不需要移动。
1. 把subSrlzr→offset作为len值填充。移动srlzr→offset。


![](https://pingcode.yasdb.com/atlas/files/public/67396c9fa1ad9a3311dc8bcd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

  


### 4.2 反序列化设计

matGetCompactColumnValue里UDT走单独的流程。

![](https://pingcode.yasdb.com/atlas/files/public/67396c9f8970c2af4f520d5b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FNQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBZ0FBRkFBRVFFQUFBQUFBQVFBRUFBQUNCQUFnQUFBQUFBQUFBQUFBSUFnQUFCQUFBUUJBQUVBQUFFQUFBQUNBQUFJZ0FBQUJBQkFBZ2dBQUFBQUFCQUFBRUF3Z0FBSUNBQUFJQUFBQUFBQUJBQUFBQUNFQWlCQVFBQUFBQUFBQUFBZ0FBQUFBQUdRQ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE4OTYsImV4cCI6MTc4MjMxMjY5Nn0.fm2TQNUHpaGRPFMBmIvwPdZAxK_ZLua6HUkDWo_BwTQ)

  


### 4.3 特性的其它点

1. 并发：物化的序列化时，TOID值的内存是私有的，不会被修改。反序列化时从字节流中取TOID。UdtDict使用Context中的值，使用期间会标记refCount。
1. 并发：TOID值是唯一递增的，在REPLACE TYPE时候TOID值会递增，序列化时把TOID值也序列化可以在反序列化时通过TOID找到数据流唯一对应的UDT定义。
1. 临时UDT： 临时UDT没有TOID值，不支持序列化、不支持发送到客户端。
1. 函数返回值的TOID值：在function、package.function、object.function的verify后把返回值的udtDict加到context上。


  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

distinct、group by、order by、limit、hash join、merge join各种组合，group_concat函数，窗口函数 connect by

  


create type udt_object as object (a1 int, a2 number, a3 varchar(64), a4 clob);    
  /    
  create table udt_t1 (c1 int, c2 number, c3 udt_object);

select * from udt_t1 order by 1;

select * from udt_t1 order by 3;   ORA-22901: 无法比较对象类型的 VARRAY 或 LOB 属性

  


  


类型嵌套场景：

|  
|OBJECT|VARRAY|TABLE|
|---|---|---|---|
|OBJECT|√|√|√|
|VARRAY|√|√|√|
|TABLE|√|√|√|


  


数据来源：

表、函数【function、package.proc、object.method、gis】、表函数。

  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

不涉及。

  


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

协议支持UDT时可以使用一套序列化格式。

从物化到协议直接放bytes流程上要适配。

  


  


  


  


  


## Attachments:

[image2023-11-16_11-47-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWQ4OTcwYzJhZjRmNTIwZDQ4IiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.JTiaE1n-OloDeJ1bchNS2B-gMc5Fk2JVjKGDdfzcJlg)

 (image/png)    


[image2023-11-14_15-27-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWQ4OTcwYzJhZjRmNTIwZDQ5IiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.A4cEKIi8MVby48agnXHuMJlyxYRyKGWYBoLstytmYx8)

 (image/png)    


[image2023-11-14_11-45-33.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWRhMWFkOWEzMzExZGM4YmJhIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.mbpO4QTLDo4Wn5uUrGrsMylCkrI5NJImWiLZv7OQNjI)

 (image/png)    


[image2023-11-14_11-44-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWQ4OTcwYzJhZjRmNTIwZDRiIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.E_r30Gz6fjBY6SMAPthBXB6tRNHWbvkqDxYb6HVM2C4)

 (image/png)    


[image2023-11-14_11-43-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWRhMWFkOWEzMzExZGM4YmJjIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.A98BzCw9BMKWpDAWMz1C1sj49yAB25fdgOtXS1sAcSQ)

 (image/png)    


[image2023-11-10_16-58-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWQ4OTcwYzJhZjRmNTIwZDRlIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.24iQH5fKrkWdu8FN8Pr56F68s-1ejzxFg5UUptUqiBc)

 (image/png)    


[image2023-11-10_16-38-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWRhMWFkOWEzMzExZGM4YmJkIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.XPTUG1NAiOV2D8YLHQu-daKd5saQiMvnqBCDfIK1EsE)

 (image/png)    


[image2023-11-10_16-37-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWQ4OTcwYzJhZjRmNTIwZDRmIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.RWAmZTa29xxiCLWDPdAbYj3fge0NdnXpVZAWqVMOzR0)

 (image/png)    


[image2023-11-10_16-34-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWVhMWFkOWEzMzExZGM4YmJlIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.QuLliGHSm1ULxYhdpmb4Fppiihgz5C5kPfGWOvJ3KdA)

 (image/png)    


[image2023-11-10_16-25-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWVhMWFkOWEzMzExZGM4YmJmIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.FHwmJoyzRGD-hFTiSymFQzo84wr5ji0YOmgZuoQd3Ko)

 (image/png)    


[image2023-11-10_15-44-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWVhMWFkOWEzMzExZGM4YmMwIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.ezXbuJonM5Fg6usiObxMvrStu8juF-tq8zRy8xQfBy8)

 (image/png)    


[image2023-11-10_15-43-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWVhMWFkOWEzMzExZGM4YmMxIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.34_Ihprk_xw_0Z637KeTlE5J6_JH0iSTbujxh09G2qo)

 (image/png)    


[image2023-11-10_15-42-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWU4OTcwYzJhZjRmNTIwZDUwIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.AQ9ZumZkSL9n09nmqnTEzuEbM7HlO7z1-6KY6V9S45w)

 (image/png)    


[image2023-11-10_15-40-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWU4OTcwYzJhZjRmNTIwZDUyIiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.xX4ot6i2Z2UsVkXMTLlN-3lMwMuvPbxwUF3lsYN0ewk)

 (image/png)    


[image2023-11-20_16-41-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWVhMWFkOWEzMzExZGM4YmM0IiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.ThCI9DEm8cCXk0mjopE6eY_0fbFstwW2bRb8bi-a1jQ)

 (image/png)    


[image2023-11-23_11-19-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWVhMWFkOWEzMzExZGM4YmM2IiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.OOecVzkcv1ToOydGi1Sfj_R4-ClIEzR62Bcs-P3tLHk)

 (image/png)    


[image2024-1-22_17-29-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjOWVhMWFkOWEzMzExZGM4YmM3IiwicmVmX2lkIjoiNjczOTZjOWQ3MjgyMDZlZmI5MmYxNDlmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxODk2LCJleHAiOjE3ODIzODgyOTZ9.AaWxDef-4o6Mtqp5dnTCY7XzIPF500VAaP0vtb6XgME)

 (image/png)    
