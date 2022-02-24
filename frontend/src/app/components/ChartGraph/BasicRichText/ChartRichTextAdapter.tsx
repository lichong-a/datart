/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Button, Menu, Modal, Row } from 'antd';
import ChromeColorPicker from 'app/components/ColorPicker/ChromeColorPicker';
import { FONT_FAMILIES, FONT_SIZES } from 'globalConstants';
import debounce from 'lodash/debounce';
import { DeltaStatic } from 'quill';
import { ImageDrop } from 'quill-image-drop-module'; // 拖动加载图片组件。
import QuillMarkdown from 'quilljs-markdown';
import {
  FC,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.bubble.css';
import 'react-quill/dist/quill.core.css';
import styled from 'styled-components/macro';
import './RichTextPluginLoader';
import {
  Formats,
  MarkdownOptions,
} from './RichTextPluginLoader/RichTextConfig';
import TagBlot from './RichTextPluginLoader/TagBlot';
import { useQuillBar } from './useQuillBar';

Quill.register('modules/imageDrop', ImageDrop);
Quill.register('formats/tag', TagBlot);
const size = Quill.import('attributors/style/size');
size.whitelist = FONT_SIZES.map(fontSize => `${fontSize}px`);
Quill.register(size, true);

const font = Quill.import('attributors/style/font');
font.whitelist = FONT_FAMILIES.map(font => font.value);
Quill.register(font, true);

const MenuItem = Menu.Item;

const CUSTOM_COLOR = 'custom-color';
const CUSTOM_COLOR_INIT = {
  background: 'transparent',
  color: '#000',
};

const ChartRichTextAdapter: FC<{
  dataList: any[];
  id: string;
  isEditing?: boolean;
  initContent: string | undefined;
  onChange: (delta: string | undefined) => void;
  openQuillMarkdown?: boolean;
  t?: (key: string) => string;
}> = memo(
  ({
    dataList,
    id,
    isEditing = false,
    initContent,
    onChange,
    openQuillMarkdown = false,
    t,
  }) => {
    const [containerId, setContainerId] = useState<string>();
    const [quillModules, setQuillModules] = useState<any>(null);
    const [visible, setVisible] = useState<boolean>(false);
    const [quillValue, setQuillValue] = useState<DeltaStatic | string>('');
    const [translate, setTranslate] = useState<DeltaStatic | string>('');

    const quillMarkdownConfigRef = useRef<any>(null);
    const quillRef = useRef<ReactQuill>(null);
    const quillEditRef = useRef<ReactQuill>(null);

    const [customColorVisible, setCustomColorVisible] =
      useState<boolean>(false);
    const [customColor, setCustomColor] = useState<{
      background: string;
      color: string;
    }>({ ...CUSTOM_COLOR_INIT });
    const [customColorType, setCustomColorType] = useState<
      'color' | 'background'
    >('color');

    useEffect(() => {
      const value = (initContent && JSON.parse(initContent)) || '';
      setQuillValue(value);
    }, [initContent]);

    useEffect(() => {
      if (id) {
        const newId = `rich-text-${id}`;
        setContainerId(newId);
        const modules = {
          toolbar: {
            container: isEditing ? `#${newId}` : null,
            handlers: {
              color: function (value) {
                if (value === CUSTOM_COLOR) {
                  setCustomColorType('color');
                  setCustomColorVisible(true);
                }
                quillEditRef.current!.getEditor().format('color', value);
              },
              background: function (value) {
                if (value === CUSTOM_COLOR) {
                  setCustomColorType('background');
                  setCustomColorVisible(true);
                }
                quillEditRef.current!.getEditor().format('background', value);
              },
            },
          },
          calcfield: {},
          imageDrop: true,
        };
        setQuillModules(modules);
      }
    }, [id, isEditing]);

    const debouncedDataChange = useMemo(
      () =>
        debounce(value => {
          onChange?.(value);
        }, 300),
      [onChange],
    );

    const quillChange = useCallback(() => {
      if (quillEditRef.current && quillEditRef.current?.getEditor()) {
        const contents = quillEditRef.current!.getEditor().getContents();
        setQuillValue(contents);
        contents && debouncedDataChange(JSON.stringify(contents));
      }
    }, [debouncedDataChange]);

    useEffect(() => {
      if (typeof quillValue !== 'string') {
        const quill = Object.assign({}, quillValue);
        const ops = quill.ops?.concat().map(item => {
          let insert = item.insert;
          if (typeof insert !== 'string') {
            if (insert.hasOwnProperty('calcfield')) {
              const name = insert.calcfield?.name;
              const config = name
                ? dataList.find(items => items.name === name)
                : null;
              if (typeof config.value === 'number')
                insert = String(config.value);
              else insert = config?.value || '';
            }
          }
          return { ...item, insert };
        });
        setTranslate(ops?.length ? { ...quill, ops } : '');
      } else {
        setTranslate(quillValue);
      }
    }, [quillValue, dataList, setTranslate]);

    useLayoutEffect(() => {
      if (quillEditRef.current) {
        quillEditRef.current
          .getEditor()
          .on('selection-change', (r: { index: number; length: number }) => {
            if (!r?.index) return;
            try {
              const index = r.length === 0 ? r.index - 1 : r.index;
              const length = r.length === 0 ? 1 : r.length;
              const delta = quillEditRef
                .current!.getEditor()
                .getContents(index, length);

              if (delta.ops?.length === 1 && delta.ops[0]?.attributes) {
                const { background, color } = delta.ops[0].attributes;
                setCustomColor({
                  background: background || CUSTOM_COLOR_INIT.background,
                  color: color || CUSTOM_COLOR_INIT.color,
                });

                const colorNode = document.querySelector(
                  '.ql-color .ql-color-label',
                );
                const backgroundNode = document.querySelector(
                  '.ql-background .ql-color-label',
                );
                if (color && !colorNode?.getAttribute('style')) {
                  colorNode!.setAttribute('style', `stroke: ${color}`);
                }
                if (background && !backgroundNode?.getAttribute('style')) {
                  backgroundNode!.setAttribute('style', `fill: ${background}`);
                }
              } else {
                setCustomColor({ ...CUSTOM_COLOR_INIT });
              }
            } catch (error) {
              console.error('selection-change callback | error', error);
            }
          });
        if (openQuillMarkdown) {
          quillMarkdownConfigRef.current = new QuillMarkdown(
            quillEditRef.current.getEditor(),
            MarkdownOptions,
          );
        } else {
          if (quillMarkdownConfigRef.current) {
            quillMarkdownConfigRef.current.destroy();
          }
        }
      }
    }, [openQuillMarkdown, quillModules]);

    const customColorChange = color => {
      if (color) {
        quillEditRef.current!.getEditor().format(customColorType, color);
      }
      setCustomColorVisible(false);
    };

    const reactQuillView = useMemo(
      () =>
        (!isEditing || visible) && (
          <ReactQuill
            ref={quillRef}
            className="react-quill-view"
            placeholder=""
            value={translate}
            modules={{ toolbar: null }}
            formats={Formats}
            readOnly={true}
          />
        ),
      [translate, quillRef, isEditing, visible],
    );

    const selectField = useCallback(
      (field: any) => () => {
        if (quillEditRef.current) {
          const quill = quillEditRef.current.getEditor();
          if (field) {
            const text = `[${field.name}]`;
            quill.getModule('calcfield').insertItem(
              {
                denotationChar: '',
                id: field.id,
                name: field.name,
                value: field.value,
                text,
              },
              true,
            );
            setImmediate(() => {
              setQuillValue(
                quillEditRef.current?.getEditor().getContents() || '',
              );
            });
          }
        }
      },
      [quillEditRef],
    );

    const fieldItems = useMemo(() => {
      return dataList?.length ? (
        <Menu>
          {dataList.map(fieldName => (
            <MenuItem key={fieldName.name}>
              <a onClick={selectField(fieldName)}>{fieldName.name}</a>
            </MenuItem>
          ))}
        </Menu>
      ) : (
        <Menu>
          <MenuItem key="nodata">暂无可用字段</MenuItem>
        </Menu>
      );
    }, [dataList, selectField]);

    const toolbar = useQuillBar(containerId, t, CUSTOM_COLOR, fieldItems);

    const reactQuillEdit = useMemo(
      () =>
        isEditing && (
          <>
            {toolbar}
            <ReactQuill
              ref={quillEditRef}
              className="react-quill"
              placeholder="请输入"
              defaultValue={quillValue}
              onChange={quillChange}
              modules={quillModules}
              formats={Formats}
              readOnly={false}
              bounds={'#quill-box'}
            />
            <Row align="middle" justify="end" style={{ paddingTop: 16 }}>
              <Button
                onClick={() => {
                  setVisible(true);
                }}
                type="primary"
              >
                预览
              </Button>
            </Row>
          </>
        ),
      [quillModules, quillValue, isEditing, toolbar, quillChange],
    );

    const ssp = e => {
      e.stopPropagation();
    };

    return (
      <TextWrap onClick={ssp}>
        <QuillBox id="quill-box">
          {quillModules && reactQuillEdit}
          {quillModules && !isEditing && reactQuillView}
        </QuillBox>
        <Modal
          title="富文本预览"
          visible={visible}
          footer={null}
          width="80%"
          getContainer={false}
          onCancel={() => {
            setVisible(false);
          }}
        >
          {isEditing && reactQuillView}
        </Modal>
        <Modal
          width={273}
          mask={false}
          visible={customColorVisible}
          footer={null}
          closable={false}
          onCancel={() => setCustomColorVisible(false)}
        >
          <ChromeColorPicker
            // @TM 该组件无法更新color 暂时用key解决
            key={customColor?.[customColorType]}
            color={customColor?.[customColorType]}
            onChange={customColorChange}
          />
        </Modal>
      </TextWrap>
    );
  },
);
export default ChartRichTextAdapter;

interface IQuillProp {
  moreBtnText: string;
}

const QuillBox = styled.div`
  width: 100%;
  height: 100%;
  flex-direction: column;
  display: flex;
  .react-quill {
    flex: 1;
    overflow-y: auto;
  }
  .react-quill-view {
    flex: 1;
    overflow-y: auto;
  }
  // @TM 自定义色块
  .ql-picker-options [data-value=${CUSTOM_COLOR}] {
    position: relative;
    width: calc(100% - 4px);
    background-color: transparent !important;
    color: #343a40;
    font-weight: 400;
    font-size: 12px;
    // todo (tianlei) Need to nationalize
    &::after {
      content: '更多';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
    &:hover {
      border: none;
    }
  }
  .ql-snow .ql-color .ql-picker-options,
  .ql-snow .ql-background .ql-picker-options {
    width: 232px;
  }
`;
const TextWrap = styled.div`
  width: 100%;
  height: 100%;

  & .ql-snow {
    border: none;
  }

  & .ql-container.ql-snow {
    border: none;
  }

  & .selectLink {
    height: 24px;
    width: 28px;
    padding: 0 5px;
    display: inline-block;
    color: black;

    i {
      font-size: 16px;
    }
  }

  & .selectLink:hover {
    color: #06c;
  }
`;
