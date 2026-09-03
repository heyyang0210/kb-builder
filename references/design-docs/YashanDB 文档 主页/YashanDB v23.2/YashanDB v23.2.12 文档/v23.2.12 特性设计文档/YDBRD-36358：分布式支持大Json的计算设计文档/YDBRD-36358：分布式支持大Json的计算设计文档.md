# YDBRD-36358：分布式支持大Json的计算设计文档

﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿

SR链接：﻿     [https://pingcode.yasdb.com/pjm/items/6757efb5622069d46df6e08f?](https://pingcode.yasdb.com/pjm/items/6757efb5622069d46df6e08f?)  #YDBRD-36358 分布式支持大json的计算

## ﻿  [ 1. 总述 ](https://pingcode.yasdb.com/#1-%E6%80%BB%E8%BF%B0)  ﻿

### ﻿  [ 1.1 需求来源 ](https://pingcode.yasdb.com/#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  ﻿

深圳卫健委--电子处方   深智城-智慧工会

当前outline lob字段计算时，报错02021错误。要支持大json JSON_XXX的计算，包含：JSON，JSON_ARRAY_GET，JSON_ARRAY_LENGTH，JSON_EXISTS，JSON_QUERY，JSON_VALUE，JSON_SERIALIZE

### ﻿  [ 1.2 特性调研 ](https://pingcode.yasdb.com/#12-%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)  ﻿

当前行表和列表在outline lob（行外存储的Json数据，Json数据大小需满足Json规格要求，即小于32M）上的计算现状如下。

|编号|函数名    |使用示例|函数作用|现状|描述链接|
|---|---|---|---|---|---|
|1|JSON|JSON(expr)|用于将expr的值转换为二进制JSON数据|无报错|  [https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON.html)  |
|2|JSON_ARRAY_GET|JSON_ARRAY_GET(json_value, index)|从一个JSON数组数据中返回指定位置的元素|无报错|  [https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_ARRAY_GET.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_ARRAY_GET.html)  |
|3|JSON_ARRAY_LENGTH|JSON_ARRAY_LENGTH(json_value)|返回一个JSON数组数据的长度|无报错|  [https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_ARRAY_LENGTH.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_ARRAY_LENGTH.html)  |
|4|JSON_EXISTS|JSON_EXISTS(json_value, json_path)|基于json_path所描述的路径对json_value进行查找，若对应查询结果不为空则返回TRUE，否则返回FALSE|无报错|  [https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_EXISTS.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_EXISTS.html)  |
|5|JSON_QUERY|JSON_QUERY(json_value, json_path, format)|将基于json_path所描述的路径对json_value进行检索，并将检索到的结果按照format_clause定义的显示选项进行封装并打印|列存报错超过32000,![image.png](https://pingcode.yasdb.com/atlas/files/public/67bbe5c739823f2ac1f25f52/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFKQUFBQUFBQUFnQUFBQUFBQUFnQUFDQUFBQUFCQUFDQUFDQUFBQUFBQUFBQUFBVUFnQUFBQUFBQUFBQUVBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFCQUFBSWdBQUFBQUFBQUFBQUFBQUFBQUZBQUFDQUFBQUFBRUFBQUFCSUFBQ0FBQUFBQUFBQUFBQUVBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjcwNDUsImV4cCI6MTc4MjM3Nzg0NX0.et_eidfyNYQQhS7S9ul_up0uSBJyi_lYiDufORIe6OU),行存报错overflow,![image.png](https://pingcode.yasdb.com/atlas/files/public/67bbe9866a1ae92ae37364db/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFKQUFBQUFBQUFnQUFBQUFBQUFnQUFDQUFBQUFCQUFDQUFDQUFBQUFBQUFBQUFBVUFnQUFBQUFBQUFBQUVBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFCQUFBSWdBQUFBQUFBQUFBQUFBQUFBQUZBQUFDQUFBQUFBRUFBQUFCSUFBQ0FBQUFBQUFBQUFBQUVBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjcwNDUsImV4cCI6MTc4MjM3Nzg0NX0.et_eidfyNYQQhS7S9ul_up0uSBJyi_lYiDufORIe6OU)|  [https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_QUERY.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_QUERY.html)  |
|6|JSON_VALUE|JSON_VALUE(expr, json_path)|基于json_path所描述的路径对json_value进行检索，并返回对应的标量值|列存报不支持,![image.png](https://pingcode.yasdb.com/atlas/files/public/67bbe5d039823f2ac1f25f53/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFKQUFBQUFBQUFnQUFBQUFBQUFnQUFDQUFBQUFCQUFDQUFDQUFBQUFBQUFBQUFBVUFnQUFBQUFBQUFBQUVBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFCQUFBSWdBQUFBQUFBQUFBQUFBQUFBQUZBQUFDQUFBQUFBRUFBQUFCSUFBQ0FBQUFBQUFBQUFBQUVBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjcwNDUsImV4cCI6MTc4MjM3Nzg0NX0.et_eidfyNYQQhS7S9ul_up0uSBJyi_lYiDufORIe6OU),行存报overflow,![image.png](https://pingcode.yasdb.com/atlas/files/public/67bbe90c6a1ae92ae37364da/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFKQUFBQUFBQUFnQUFBQUFBQUFnQUFDQUFBQUFCQUFDQUFDQUFBQUFBQUFBQUFBVUFnQUFBQUFBQUFBQUVBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFCQUFBSWdBQUFBQUFBQUFBQUFBQUFBQUZBQUFDQUFBQUFBRUFBQUFCSUFBQ0FBQUFBQUFBQUFBQUVBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjcwNDUsImV4cCI6MTc4MjM3Nzg0NX0.et_eidfyNYQQhS7S9ul_up0uSBJyi_lYiDufORIe6OU)|  [https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_VALUE.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_VALUE.html)  |
|7|JSON_SERIALIZE|JSON_SERIALIZE(json_value returning_clause PRETTY EXTENDED)|将二进制json数据按照pretty格式或compact格式序列化为字符串，且序列化后的字符串长度不超过   `returning_clause`   定义的限制值|列存报错超过32000,![image.png](https://pingcode.yasdb.com/atlas/files/public/67bbe62f39823f2ac1f25f55/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFKQUFBQUFBQUFnQUFBQUFBQUFnQUFDQUFBQUFCQUFDQUFDQUFBQUFBQUFBQUFBVUFnQUFBQUFBQUFBQUVBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFCQUFBSWdBQUFBQUFBQUFBQUFBQUFBQUZBQUFDQUFBQUFBRUFBQUFCSUFBQ0FBQUFBQUFBQUFBQUVBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjcwNDUsImV4cCI6MTc4MjM3Nzg0NX0.et_eidfyNYQQhS7S9ul_up0uSBJyi_lYiDufORIe6OU),行存报错超出buffer大小,![image.png](https://pingcode.yasdb.com/atlas/files/public/67bbe9a56a1ae92ae37364de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFFQUFKQUFBQUFBQUFnQUFBQUFBQUFnQUFDQUFBQUFCQUFDQUFDQUFBQUFBQUFBQUFBVUFnQUFBQUFBQUFBQUVBQUFBQUFBZ0VBQUFBQUFBQUFBQUFBQUFBQUFDQUFJQUFBQUFCQUFBSWdBQUFBQUFBQUFBQUFBQUFBQUZBQUFDQUFBQUFBRUFBQUFCSUFBQ0FBQUFBQUFBQUFBQUVBQUVBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNjcwNDUsImV4cCI6MTc4MjM3Nzg0NX0.et_eidfyNYQQhS7S9ul_up0uSBJyi_lYiDufORIe6OU)|  [https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_SERIALIZE.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/Development-Guide/SQL-Reference-Manual/Built-in-Functions/JSON_SERIALIZE.html)  |


### ﻿  [ 1.3 需求分析 ](https://pingcode.yasdb.com/#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  ﻿

### ﻿  [ 1.4 开源依赖 ](https://pingcode.yasdb.com/#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  ﻿

## ﻿  [ 2. 接口 ](https://pingcode.yasdb.com/#2-%E6%8E%A5%E5%8F%A3)  ﻿

接口使用方式和现状保持一致。

## ﻿  [ 3. 规格与约束 ](https://pingcode.yasdb.com/#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  ﻿

1、分布式列存支持。

2、不支持行外存储的Json转换为clob/blob/varchar/char()等类型。

3、和行存一样，Json函数计算结果的长度不能超过32000，否则报错。

## ﻿  [ 4. 特性 ](https://pingcode.yasdb.com/#4-%E7%89%B9%E6%80%A7)  ﻿

### ﻿4.1 列存增加JSON_VALUE函数支持

 由于行存支持了JSON_VALUE函数，列存和分布式在支持时，采用通用表达式的方式实现。

 通用表达式中不支持行外lob的处理，因此在set_variant_value函数中，针对Json类型添加行外lob的支持，如下

```
                if val.is_calc_outline() {
                    variant.set_value(&JsonType, Some(val), buffer, ctx, col)?;
                } else {
                    let len = VAR_LOB_HEAD_LEN + val.as_bytes().len();
                    buffer.reserve(len).map_err(|_| Error::MemAllocError(len))?;
                    unsafe { variant.set_lob_value_direct(val.as_bytes(), buffer.as_mut_ptr()) };
                }
```

### 4.2 attach_to_dataset新增支持json类型

在attach_to_data_set_with_rows和attach_to_data_set_with_explict函数中，新增Json类型的判断，当数据列的类型是Json时，调用新增的create_new_json_column函数，依据数据列的内容是否行外，进行处理。

在create_new_json_column函数中，判断数据量是否行外，若是行内，则按照现有逻辑直接clone返回，否则，构造lob信息，将json数据包装成lob，同时将json的数据内容缓存到Json列的calc_outline_buf中，供后续读取使用。

create_new_json_column的实现逻辑如下

```
 let mut lob = LobBuf::new(json.as_bytes().try_to_vec_in(ctx.std_alloc()?)?);
                    if json.is_calc_outline() {
                        let buf_id = json.calc_outline_buf_id();
                        let yason = col.calc_outline_json(buf_id)?;
                        let lob_size = json.outline_lob_size();
                        let query_ctx_buf_id = query_ctx.append_outline_lob(OutlineLobBuf::new(
                            CodArc::try_new_in(
                                Buffer::alloc_from(ctx.alloc(), yason.as_bytes())?,
                                ctx.std_alloc()?,
                            )?,
                            lob_size,
                        ))?;

                        lob.set_mem_lob_locator(query_ctx_buf_id);
                        lob.set_mem_lob_flag(false);
                    }

                    json_builder_append_outline_json(
                        cursor,
                        &mut json_builder,
                        &mut ank_column,
                        lob,
                        var_lob_buf,
                        col_lob_head,
                    )?;
```

### 4.3 分布式DstbLobHead增加sid属性

分布式下Lob的请求和应答本质上还是走的普通的lob协议，在lob数据包的头部增加了分布式特有的包头DstbLobHead。

分布式支持大Lob的设计文档，请参考：  [https://pingcode.yasdb.com/wiki/pages/67396b25593f99c9ff235e86](https://pingcode.yasdb.com/wiki/pages/67396b25593f99c9ff235e86)  

由于handler会复用，且分布式DN之间的LOB消息传输共用一条ICS通道，因此在DstbLobHead中增加sid属性，用来区分不同的会话。



## ﻿  [ 5. Testcases（自测用例） ](https://pingcode.yasdb.com/#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  ﻿

|测试场景    |测试步骤|预期|
|---|---|---|
|1、CREATE TABLE AS SELECT LOB列|1、创建表，构造满足json格式的行外大LOB,2、调用CREATE TABLE AS SELECT JSON(C1)创建新表|1、CREATE成功,2、SELECT成功|
|2、UPDATE SET FROM LOB列|1、创建表，构造满足json格式的行外大LOB,2、调用UPDATE SET COL2=JSON(COL1)更新JSON列,3、调用UPDATE SET COL2=COL1更新JSON列|1、UPDATE成功,2、SELECT成功|
|3、INSERT INTO SELECT LOB列|1、创建表1，构造满足json格式的行外大LOB,2、INSERT INTO SELECT JSON(COL)插入表2|1、INSERT成功,2、SELECT成功|
|4、INSERT INTO SELECT LOB列到复制表|1、创建表1，构造满足json格式的行外大LOB,2、创建表2复制表,3、INSERT INTO SELECT JSON(COL)插入表2,4、INSERT INTO SELECT COL插入表2|1、INSERT成功,2、SELECT成功|
|5、CREATE DUPLICATED TABLE AS SELECT LOB列|1、创建表，构造满足json格式的行外大LOB,2、调用CREATE DUPLICATED  TABLE AS SELECT创建新表|1、CREATE成功,2、SELECT成功|
|6、CREATE TABLE AS SELECT JSON列|1、创建表，构造行外JSON,2、调用CREATE TABLE AS SELECT创建新表|1、CREATE成功,2、SELECT成功|
|7、UPDATE SET FROM JSON列|1、创建表，构造行外JSON,2、调用UPDATE SET COL2=COL1更新JSON列|1、UPDATE成功,2、SELECT成功|
|8、INSERT INTO SELECT JSON列|1、创建表1，构造行外JSON,2、INSERT INTO SELECT COL插入表2|1、INSERT INTO 成功,2、SELECT成功|
|9、INSERT INTO SELECT JSON列到复制表|1、创建表1，构造行外JSON,2、创建表2复制表,3、INSERT INTO SELECT COL插入表2|1、INSERT成功,2、SELECT成功|
|10、CREATE DUPLICATED TABLE AS SELECT JSON列|1、创建表，构造行外JSON,2、调用CREATE DUPLICATED  TABLE AS SELECT创建新表|1、CREATE成功,2、SELECT成功|
|11、INSERT INTO分区表|1、创建表1，构造行外JSON,2、创建表2分区表,3、INSERT INTO SELECT COL插入表2|1、INSERT成功,2、SELECT成功|
|12、JSON_ARRAY_LENGTH|1、创建表，构造行外存储的JsonArray数据,2、调用JSON_ARRAY_LENGTH计算|1、执行成功|
|13、JSON_ARRAY_GET|1、创建表，构造行外存储的JsonArray数据,2、调用JSON_ARRAY_GET计算|1、执行成功|
|14、JSON_EXISTS|1、创建表，构造行外存储的JsonArray数据,2、调用JSON_EXISTS计算|1、执行成功|
|15、JSON_QUERY|1、创建表，构造行外存储的JsonArray数据,2、调用JSON_QUERY计算|1、执行成功|
|16、JSON_VALUE|1、创建表，构造行外存储的JsonArray数据,2、调用JSON_VALUE计算|1、执行成功|
|17、JSON_SERIALIZE|1、创建表，构造行外存储的JsonArray数据,2、调用JSON_SERIALIZE计算|1、执行成功|
|18、组合嵌套|符合组合嵌套条件的函数，进行组合嵌套后执行计算|1、执行成功|


## ﻿  [ 6.资料设计章节 ](https://pingcode.yasdb.com/#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  ﻿

JSON函数的资料描述中，删除列存约束、行外约束等相关的约束信息。

## ﻿  [ 7.未来规划 ](https://pingcode.yasdb.com/#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  ﻿

支持行外json向clob/blob/varchar/char()等类型的转换。