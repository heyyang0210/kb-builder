Created by 施新华 on 十一月 14, 2023

# 1.   **概述**

LSC能力补全，LSC表支持alter add column与alter drop column特性，通过alter add/drop 增删表列属性。

# 2.   **需求分析**

**SR：**    [YDBRD-1305](https://jira.yasdb.com/browse/YDBRD-1305?src=confmacro)    **-**  **支持LSC的增删列（含分区表）**  **完成**

- 功能


LSC支持增删列特性。

- 外部接口


  [YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20TABLE.html)     文档中     `add_column_clause 及 `      `drop_column_clause 语法；`  

![](https://pingcode.yasdb.com/atlas/files/public/6739696a8970c2af4f51f7fb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcyODcsImV4cCI6MTc4MjEzODA4N30.bdCkZ0aluppe9NvbTMOYSJOumLTOZHDXqUuHQnw8XpA)

  


- 功能约束


1.LSC表目前只支持增加默认列，或者null列，暂不支持增列后立即回填该列的情况（如lob和序列默认值）。--- 不会生成存储文件。

2.只支持通过alter add/drop的增删列特性，不支持alter add/drop外键，主键等特性。--- 主键、唯一键 sr 转测后，sit 补测；

3.add column特性只支持目前lsc表支持的列类型。

4.不支持删除order key 列。

5.其他限制于tac和heap相同

- 实现流程


见开发设计文档

# 3.   **测试设计方法**

使用场景测试，结合等价类、边界值进行测试设计。

测试策略：

1、可参考 heap 表及 tac 表增删列的自动化用例；额外考虑 lsc 表特有的功能：冷、热数据存储的不同、压缩、编码、冷数据的排序列；

2、分布式针对分布键、多 cn 场景做补充测试；其他测试用例同单机；

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

1、从语法上分析，该 sr 支持的功能；

- 增加列


ALTER TABLE [schema "."] table_name ADD [COLUMN] "(" column_definition {"," column_definition} ")" [lob_clauses]

  [column_definition](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20TABLE.html#columndefinition)    **::=**

```
<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token rule">column dataType</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">DEFAULT default_expr</span> <span class="token operator" style="color: rgb(103,205,204);">|</span> <span class="token rule">inline_constraint</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span>
<span class="token punctuation" style="color: rgb(204,204,204);">{</span><span class="token string" style="color: rgb(126,198,153);">" "</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">DEFAULT default_expr</span> <span class="token operator" style="color: rgb(103,205,204);">|</span> <span class="token rule">inline_constraint</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">}</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span><span class="token punctuation" style="color: rgb(204,204,204);">.</span> 

```

  [inline_constraint](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/constraint.html#inlineconstraint)    **::=**

```
<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">CONSTRAINT constraint_name</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">UNIQUE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">PRIMARY KEY</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">references_clause</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">CHECK condition</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">NOT</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">NULL</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">constraint_state</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span><span class="token punctuation" style="color: rgb(204,204,204);">.
</span>
```

  [references_clause](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/constraint.html#referencesclause)    **::=**

```
<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token rule">REFERENCES</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">schema</span> <span class="token string" style="color: rgb(126,198,153);">"."</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">ref_table_name</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token string" style="color: rgb(126,198,153);">"("</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">column_name</span> <span class="token punctuation" style="color: rgb(204,204,204);">{</span><span class="token string" style="color: rgb(126,198,153);">","</span> <span class="token rule">column_name</span><span class="token punctuation" style="color: rgb(204,204,204);">}</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span> <span class="token string" style="color: rgb(126,198,153);">")"</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">ON DELETE</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">RESTRICT</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">NO ACTION</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">CASCADE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">SET NULL</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">ON UPDATE RESTRICT</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span>
```

  [constraint_state](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/constraint.html#constraintstate)    **::=**

```
<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">NOT DEFERRABLE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">INITIALLY IMMEDIATE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">RELY</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">NORELY</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">using_index_clause</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">ENABLE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">DISABLE</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">VALIDATE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">NOVALIDATE</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span>
<span class="token punctuation" style="color: rgb(204,204,204);">{</span><span class="token string" style="color: rgb(126,198,153);">" "</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">NOT DEFERRABLE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">INITIALLY IMMEDIATE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">RELY</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">NORELY</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">using_index_clause</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">ENABLE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">DISABLE</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">VALIDATE</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">NOVALIDATE</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">}</span><span class="token punctuation" style="color: rgb(204,204,204);">.</span>
```

  [using_index_clause](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/constraint.html#usingindexclause)    **::=**

```
<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token rule">USING INDEX</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token string" style="color: rgb(126,198,153);">"schema."</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token rule">index_name</span> <span class="token operator" style="color: rgb(103,205,204);">|</span> <span class="token string" style="color: rgb(126,198,153);">"("</span> <span class="token rule">create_index_clause</span> <span class="token string" style="color: rgb(126,198,153);">")"</span> <span class="token operator" style="color: rgb(103,205,204);">|</span> <span class="token rule">index_attr_clause</span> <span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">.</span>
```

  [lob_clauses](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20TABLE.html#lobclause)    **::=**

```
<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token rule">lob_clause</span> <span class="token punctuation" style="color: rgb(204,204,204);">{</span><span class="token string" style="color: rgb(126,198,153);">" "</span> <span class="token rule">lob_clause</span><span class="token punctuation" style="color: rgb(204,204,204);">}</span><span class="token punctuation" style="color: rgb(204,204,204);">.</span>
```

  [lob_clause](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20TABLE.html#lobclause)    **::=**

  `= LOB "(" column {"," column} ")" STORE AS [BASICFILE|SECUREFILE]  
"("(TABLESPACE space_name|(ENABLE|DISABLE) STORAGE IN ROW)")".`  

根据上述语法，归类功能：

1、增加单列、多列；指定及不指定默认值，数据类型覆盖：  TINYINT、SMALLINT、INT、BIGINT、FLOAT、DOUBLE、NUMBER(列跟行实现不同，重点考虑)、BIT（列不支持）、CHAR、VARCHAR、BOOL、DATE、TIME、TIMESTAMP、INTERVAL YEAR TO MONTH、INTERVAL DAY TO SECOND、RAW、UROWID、ST_GEOMETRY（列不支持）；默认值包括：字面量、运算式、函数等表达式

2、增加单列、多列；指定行内约束，包括：唯一索引、主键、外键、check 约束 ---不支持功能，只分别验证报错

3、增加单列、多列；指定行内约束，包括：not null、null、default

4、增加单列、多列；列类型为 lob 类型：clob、blob、json，支持 null 值，不支持 default 值；考虑：行内存储、行外存储

5、增加列，类型为嵌套类型 ---- 不支持的功能，只验证报错

6、增加单列、多列；指定列的 compression_clause、    `encoding_clause 属性`  

-   `删除列`  


  `ALTER TABLE [schema "."] table_name `      `DROP drop_column`  

  [drop_column](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20TABLE.html#dropcolumn)    **::=**

```
<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token rule">COLUMN</span><span class="token punctuation" style="color: rgb(204,204,204);">]</span> <span class="token string" style="color: rgb(126,198,153);">"("</span> <span class="token rule">column_name</span> <span class="token punctuation" style="color: rgb(204,204,204);">{</span><span class="token string" style="color: rgb(126,198,153);">","</span> <span class="token rule">column_name</span><span class="token punctuation" style="color: rgb(204,204,204);">}</span> <span class="token string" style="color: rgb(126,198,153);">")"</span><span class="token punctuation" style="color: rgb(204,204,204);">.</span>
```

```
根据语法，归类功能：
删除单列、多列,列属性覆盖：
1、同增加列的属性
2、删除&nbsp;table_sort_clause&nbsp;列----&nbsp;报错
```

2、从存储层面，热数据和冷数据是2种存储结构，根据支持的语法分别进行测试；

3、功能层面，还需要考虑：

- 表类型：partition table、table ---- lsc 表不支持 global temporary table、private temporary table，不考虑测试；
- 表属性：考虑 ROW MOVEMENT ENABLE 属性，compression_clause、table_sort_clause、mcol_ttl_clause、nologging、compact(slice 合并)，其他表属性不考虑；
- 表空间属性：压缩


基本功能测试场景测试策略：

均使用如下测试步骤进行测试，分布式与单机用例相同；同时分布式场景，增加对分布键的删除及复制表的测试；

1、创建表

2、插入数据 

3、根据测试点，不转冷/转冷数据

4、增加列/删除列

5、增删改查/truncate 数据，功能正常

6、热数据转冷数据

  


多次增删列及多次转换合并

插入数据 ---- 转冷 ---增删列---- 插入数据---- 转冷----增删列----插入数据  ---- 不同 slice 文件的列数不同

  


并发场景分析，如下并发场景需分别覆盖热数据及冷数据；

1、ddl 并发：

对同一个表增加列并发、删除列并发、增删列并发

对不同表进行增删列并发

2、ddl 与 dml 并发

3、ddl 与查询并发

4、分布式场景中考虑单/多 cn 场景上的上述并发场景

  


异常场景分析：

1、在上述并发场景中增加节点异常

2、分布式考虑：cn/mn/dn 主节点异常(强杀、正常停止)

  


工具：导入工具；

导入过程中，增删列，导入失败；---- 导入工具少列和多列是否能导入成功？

1、导入过程中不能做 ddl 操作

2、根据 ctrl 文件中指定的字段导入数据，与 c

  


接口验证：在功能测试场景中覆盖

  


迭代 5 补充测试场景

1、增加单列、多列；指定及不指定默认值，数据类型覆盖：  BIT、ST_GEOMETRY；默认值包括：字面量、运算式、函数等表达式

2、增加单列、多列；指定行内约束，包括：唯一索引、主键、外键、check 约束

3、增加单列、多列；列类型为 lob 类型：  blob  ；考虑：行内存储、行外存储，  默认值包括：字面量、运算式、函数等表达式

4、增加列，类型为自定义类型

5、复制表上执行 add/drop column, 覆盖所有类型----可以用原来自动化用例执行；

以上所有测试场景均需插入数据 ，同时覆盖冷热 2 种数据；

  


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|涉及|
|长稳|不涉及|
|一致性|涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

HA 环境

  


  [XXX功能测试设计.doc](#)  

## Attachments: